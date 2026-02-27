Tiny utility to beam Mermaid in a Markdown file to a local TLDraw instance to pan and zoom.

It renders any Mermaid diagrams in the Markdown file as images and injects them into TLDraw as objects so it's easier to view them.

## Install locally as a command

From this repo:

```bash
cd beam
npm install
npm run build
npm link
```

Then from any folder:

```bash
beam ./shaping.md
```

## Usage

```bash
beam <markdown-file>
```

Example:

```bash
beam ./some-file-with-mermaid.md
```
