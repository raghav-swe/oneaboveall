# OneAboveAll (OAA) - Frontend

Control-plane UI for the OAA agentic SRE platform. Next.js 14 + Tailwind + @xyflow/react.

## Run it
```bash
npm install
npm run dev
# open http://localhost:3000
```
Needs Node.js 18.17 or newer.

## How we build this with AI tools (free-tier friendly)
1. Open a fresh chat in any AI tool.
2. Paste `prompts/kickoff.md`, then `CONTEXT.md`, `PROGRESS.md`, and the page spec you are working on.
3. Copy the matching prompt from `prompts/steps.md` and send it.
4. Paste the returned files into the paths it names. Run `npm run dev` and check the page.
5. If it works: tick the item in `PROGRESS.md`, commit with git. If it breaks: send the exact error and the one file involved.
6. Next chat/tool: repeat from step 1 with the updated `PROGRESS.md`.

Commit after every working step (`git add . && git commit -m "dashboard: bento 1"`) so you can undo a bad AI answer.
