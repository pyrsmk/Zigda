import { query } from './db.js'
import { requestOrigin } from './http.js'
import { mailEnabled, sendMails } from './mail.js'
import { settings } from './repo.js'

const EXCERPT_LENGTH = 400

function excerpt(text) {
  const trimmed = text.trimEnd()
  const short = trimmed.length > EXCERPT_LENGTH ? `${trimmed.slice(0, EXCERPT_LENGTH)}…` : trimmed
  return short
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

function nameOf(user) {
  return user.name || user.login
}

function link(path) {
  return `${requestOrigin()}${path}`
}

function discussionLink(threadId, path) {
  return link(`/file/${path.split('/').map(encodeURIComponent).join('/')}?discussion=${threadId}`)
}

function proposalLink(proposal) {
  return proposal.action === 'replace'
    ? discussionLink(proposal.thread_id, proposal.path)
    : link(`/proposals/${proposal.id}`)
}

function threadLink(thread) {
  return thread.kind === 'passage' ? discussionLink(thread.id, thread.path) : proposalLink(thread.proposal)
}

async function everyone() {
  const rows = await query('select id from users where active')
  return rows.map((r) => r.id)
}

async function deliver(userIds, { except, subject, paragraphs, url }) {
  if (!mailEnabled()) return
  try {
    const users = await query(
      `select email from users where active and email is not null and id = any($1) and id is distinct from $2`,
      [userIds, except],
    )
    if (!users.length) return
    const { repo_name } = await settings()
    const text = [...paragraphs.filter(Boolean), url].join('\n\n')
    await sendMails(users.map((u) => ({ to: u.email, subject: `[${repo_name}] ${subject}`, text })))
  } catch (err) {
    console.warn('[notify]', subject, err.message)
  }
}

export async function notifyProposed(proposal, author) {
  const name = nameOf(author)
  const { subject, details } = {
    replace: () => ({
      subject: `${name} proposed a new version in ${proposal.path}`,
      details: [`Passage:\n${excerpt(proposal.base_content)}`, `New version:\n${excerpt(proposal.content)}`],
    }),
    create: () => ({
      subject: `${name} proposed to create ${proposal.path}`,
      details: [proposal.content && excerpt(proposal.content)],
    }),
    delete: () => ({ subject: `${name} proposed to delete ${proposal.path}`, details: [] }),
  }[proposal.action]()
  await deliver(await everyone(), {
    except: author.id,
    subject,
    paragraphs: [`${subject}.`, ...details, 'Your approval is needed.'],
    url: proposalLink(proposal),
  })
}

export async function notifyQuestion(thread, author, message) {
  const subject = `${nameOf(author)} started a discussion in ${thread.path}`
  await deliver(await everyone(), {
    except: author.id,
    subject,
    paragraphs: [`${subject}.`, `Passage:\n${excerpt(thread.anchor.quote)}`, `Message:\n${excerpt(message)}`],
    url: discussionLink(thread.id, thread.path),
  })
}

export async function notifyReply(thread, author, message) {
  const participants = await query(
    `select created_by as id from threads where id = $1
     union select author_id from messages where thread_id = $1 and kind = 'text'
     union select author_id from proposals where thread_id = $1`,
    [thread.id],
  )
  const subject = `${nameOf(author)} replied in a discussion on ${thread.path}`
  await deliver(
    participants.map((r) => r.id),
    { except: author.id, subject, paragraphs: [`${subject}:`, excerpt(message)], url: threadLink(thread) },
  )
}

export async function notifyApproved(proposal, approver) {
  const subject = `${nameOf(approver)} approved your proposal on ${proposal.path}`
  await deliver([proposal.author_id], {
    except: approver.id,
    subject,
    paragraphs: [`${subject}.`],
    url: proposalLink(proposal),
  })

  const waiting = await query(
    `select id from users where active and id <> $2
        and id not in (select user_id from approvals where proposal_id = $1)`,
    [proposal.id, proposal.author_id],
  )
  if (waiting.length !== 1) return
  await deliver([waiting[0].id], {
    except: approver.id,
    subject: `Only your approval is missing on ${proposal.path}`,
    paragraphs: [
      `Every other member approved a proposal on ${proposal.path}: as soon as you approve it, it will be applied to the repository.`,
    ],
    url: proposalLink(proposal),
  })
}

export async function notifyApplied(proposal, actor) {
  await deliver([proposal.author_id], {
    except: actor.id,
    subject: `Your proposal on ${proposal.path} has been applied`,
    paragraphs: ['Everyone approved it: it has been committed to the repository.'],
    url: proposalLink(proposal),
  })
}

export async function notifyRejected(proposal, actor) {
  const subject = `${nameOf(actor)} rejected your proposal on ${proposal.path}`
  await deliver([proposal.author_id], {
    except: actor.id,
    subject,
    paragraphs: [`${subject}.`],
    url: proposalLink(proposal),
  })
}

export async function notifyDiscarded(proposals, actor) {
  for (const proposal of proposals) {
    await deliver([proposal.author_id], {
      except: actor.id,
      subject: `Your version in ${proposal.path} has been set aside`,
      paragraphs: ['Another version of the passage was approved by everyone and applied.'],
      url: proposalLink(proposal),
    })
  }
}

export async function notifyLost(proposals, path, reason) {
  if (!proposals.length) return
  await deliver(
    proposals.map((p) => p.author_id),
    {
      subject: `Your proposal on ${path} has been lost`,
      paragraphs: [
        reason === 'passage_changed'
          ? 'The passage was changed directly in the repository: its discussion has been closed.'
          : 'The file has been deleted.',
      ],
      url: link('/proposals'),
    },
  )
}

export async function notifyReset(proposal, author, userIds) {
  const subject = `${nameOf(author)} updated their proposal on ${proposal.path}`
  await deliver(userIds, {
    except: author.id,
    subject,
    paragraphs: [`${subject}: your approval has been reset, please review it again.`],
    url: proposalLink(proposal),
  })
}

export async function notifyDeletionReady(thread, actorId) {
  if (thread.kind !== 'passage') return
  const ready = await query(
    `select * from proposals p
      where p.path = $1 and p.action = 'delete' and p.status = 'pending' and p.created_at > $2
        and not exists (
          select 1 from threads t
           where t.path = p.path and t.kind = 'passage' and t.status = 'open' and t.created_at < p.created_at
        )`,
    [thread.path, thread.created_at],
  )
  for (const proposal of ready) {
    await deliver(
      (await everyone()).filter((id) => id !== proposal.author_id),
      {
        except: actorId,
        subject: `The deletion of ${proposal.path} can now be approved`,
        paragraphs: ['The older discussions on this file are settled.'],
        url: proposalLink(proposal),
      },
    )
  }
}
