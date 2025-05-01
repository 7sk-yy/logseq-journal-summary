// https://plugins-doc.logseq.com/
const settings = [
  {
    key: "settings",
    title: "Settings",
    type: "heading",
  },
  {
    key: "keyword",
    title: "Log keyword",
    type: "string",
    default: "## Log",
  },
  {
    key: "nest",
    title: "Log nest",
    type: "number",
    default: 1,
  },
  {
    key: "regexp",
    title: "Regexp",
    description: "need group 'start', 'end', 'tag'",
    type: "string",
    default: "`(?<start>\\d{2}:\\d{2}) - (?<end>\\d{2}:\\d{2})` (?<tag>#\\S+)",
  },
];

function main() {
  logseq.useSettingsSchema(settings);

  logseq.Editor.registerSlashCommand("Insert Agg Renderer", async () => {
    await logseq.Editor.insertAtEditingCursor("{{renderer journal-summary}}");
  });

  logseq.App.onMacroRendererSlotted(async ({ slot, payload }) => {
    const [type] = payload.arguments;
    const uuid = payload.uuid;

    console.log(slot, payload);

    if (type === "journal-summary") {
      const block = await logseq.Editor.getBlock(uuid);
      const page = await logseq.Editor.getPage(block.page.id);
      const tree = await logseq.Editor.getPageBlocksTree(page.uuid);

      const [node] = tree.filter((t) => t.content === logseq.settings.keyword);

      try {
        if (!node) {
          throw new Error(`"${logseq.settings.keyword}" not exist`);
        }

        var children = node.children;
        for (let i = 0; i < logseq.settings.nest; i++) {
          children = children.map((child) => child.children).flat();
        }

        const contents = children.map((child) => {
          const groups = child.content.match(logseq.settings.regexp).groups;

          const start = groups.start.split(":");
          const end = groups.end.split(":");

          const elapsed =
            parseInt(end[0]) * 60 +
            parseInt(end[1]) -
            (parseInt(start[0]) * 60 + parseInt(start[1]));

          return {
            ...groups,
            elapsed: elapsed / 60,
          };
        });

        const agg = Object.entries(
          contents.reduce((acc, { tag, elapsed }) => {
            acc[tag] = (acc[tag] || 0) + elapsed;
            return acc;
          }, {})
        );

        const rows = agg
          .map(
            (r) => `
              <tr>
                <td><a data-ref="${r[0]}" class="tag">${r[0]}</a></td>
                <td>${r[1]}</td>
              </tr>`
          )
          .join("");

        logseq.provideUI({
          template: `
            <table data-slot-id="${slot}" data-block-uuid="${uuid}">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
            `,
          key: "journal-summary",
          slot: slot,
          reset: true,
        });
      } catch (e) {
        logseq.provideUI({
          key: "journal-summary",
          template: `<div data-slot-id="${slot}" data-block-uuid="${uuid}">${e}</div>`,
          slot: slot,
          reset: true,
        });
      }
    }
  });
}

// bootstrap
logseq.ready().then(main).catch(console.error);
