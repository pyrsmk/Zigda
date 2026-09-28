# Zigda

A simple space to read, discuss and collaboratively edit the text files of a GitHub repository
(stories, dialogues, scripts, code…) — without anyone needing to know how GitHub works.

## Features

- **GitHub sign-in only.** The first person to sign in becomes the owner of the space: they pick a
  repository and branch from their own repositories, then invite others by their GitHub username.
  Nobody else can get in.
- **Invited members need no access to the repository.** Zigda reads and writes using the owner's GitHub
  access (stored encrypted). Every change committed to the repository is authored by the person who
  proposed it, and the commit message credits those who approved it.
- **Browsing**: file tree, formatted view (rendered Markdown, syntax-highlighted code) or raw text,
  images, and per-file change history.
- **Discussions**: select a passage to comment on it. The passage stays highlighted, the discussion can
  be resolved, and the highlight follows the passage even when the text around it changes.
- **Proposals**: nothing is written to the repository without the approval of every other team member.
  A proposal can be:
  - a suggestion on a selected passage ("replace with…");
  - a full edit of a file in the editor;
  - the creation or deletion of a file.

### How approval works

- Every signed-in member except the author must approve. As soon as the last approval comes in, the
  change is committed to the branch and the discussion is closed.
- A single rejection closes the proposal.
- If the author edits their proposal, approvals start over.
- The members counted are those present at the time of the last approval: a newcomer must approve too,
  and a removed member is no longer waited for (removing them applies any proposals that were only
  waiting on them). An invited person only counts once they have signed in.
- If the file changed in the meantime, Zigda merges automatically when possible. Otherwise the proposal
  is marked as needing rework and its author resolves the conflicting passages in the editor.

## Deployment

Zigda is designed to run on [Vercel](https://vercel.com) with a Postgres database
(e.g. [Supabase](https://supabase.com)).

### 1. Create a GitHub OAuth App

On GitHub, go to *Settings → Developer settings → OAuth Apps → New OAuth App*:

- **Homepage URL**: `https://your-domain.vercel.app`
- **Authorization callback URL**: `https://your-domain.vercel.app/api/auth/callback`

Copy the *Client ID* and generate a *Client secret*.

### 2. Create the database

Create a Supabase project and copy its Postgres connection string
(*Connect → Transaction pooler*, port 6543). The Supabase integration from the Vercel marketplace works
too: it provides `POSTGRES_URL`, which is picked up automatically.

Tables are created automatically on first use.

### 3. Deploy to Vercel

Import the repository into Vercel and set the following environment variables:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (or `POSTGRES_URL` via the Supabase integration) |
| `GITHUB_CLIENT_ID` | OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret |
| `SESSION_SECRET` | Long random string used to sign sessions and encrypt the owner's GitHub access |

Generate a secret with:

```bash
openssl rand -base64 48
```

> [!WARNING]
> Do not change `SESSION_SECRET` once set: the stored GitHub access would become unreadable. If it
> happens, the owner just needs to sign in again from the Settings page.

Deploy, then sign in: the first person to sign in becomes the owner of the space.

## Local development

Requirements: Node.js 24, Ruby, [Run](https://rubygems.org/gems/run_tasks) and a Postgres database.

Install Run with:

```bash
gem install run_tasks
```

Create a second GitHub OAuth App for local use, with `http://localhost:5173` as homepage URL and
`http://localhost:5173/api/auth/callback` as callback URL.

```bash
run install
cp .env.example .env   # fill in the variables
run dev                # app and API on http://localhost:5173
```

To create the database tables manually:

```bash
run db_init
```

To build the app for production:

```bash
run build
```

Run `run help` to list all available tasks.

### Optional variables

| Variable | Description |
| --- | --- |
| `GITHUB_URL` | GitHub base URL (default: `https://github.com`) |
| `GITHUB_API_URL` | GitHub API base URL (default: `https://api.github.com`) |

Useful to target GitHub Enterprise or a mock GitHub server.

## License

This is released under the [Don't Be A Dick](https://dont-be-a-dick.animi.st/) license.
