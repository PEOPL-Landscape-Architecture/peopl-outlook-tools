/* =============================================================================
 * PEOPL Email Templates  —  TEMPLATE DATA
 * =============================================================================
 * This is the ONLY file you normally need to edit. Add or change templates
 * here, save, then push to GitHub (or run /backup). The add-in updates.
 *
 * HOW IT WORKS
 * ------------
 * Each template has a `subject` and a `body`. Anywhere you write a token like
 *     {{client}}      or      {{scope}}
 * the add-in shows a control in the task pane so you can fill it in or pick a
 * phrase from a dropdown. Your choice is swapped into the email.
 *
 * Define each token under `slots`:
 *
 *   DROPDOWN of phrases / paragraphs:
 *     scope: {
 *       label: "Scope paragraph",
 *       options: [
 *         "A short phrase, used exactly as written",
 *         { label: "Shown in the dropdown", text: "The longer text that gets inserted." }
 *       ],
 *       default: "Shown in the dropdown"   // optional: preselect by label or text
 *     }
 *
 *   FREE TEXT (single line):
 *     client: { label: "Client name", type: "text", placeholder: "e.g. Jane Smith" }
 *
 *   FREE TEXT (paragraph / multi-line):
 *     notes: { label: "Notes", type: "textarea", default: "" }
 *
 * TIPS
 *  - Any {{token}} you DON'T define under `slots` automatically becomes a
 *    single-line text box, so you can drop quick fill-ins in without setup.
 *  - Use \n for a line break inside an option's text, or just press Enter in a
 *    textarea slot.
 *  - The same token can appear more than once in the body; it fills everywhere.
 * ===========================================================================*/

window.PEOPL_TEMPLATES = [

  /* --------------------------------------------------------------- 1. PROPOSAL */
  {
    id: "fee-proposal",
    name: "Fee proposal",
    subject: "Fee proposal — {{project}}",
    body:
`Dear {{client}},

Thank you for the opportunity to provide a fee proposal for {{project}}.

{{scope}}

Our fee for this work is {{fee}} {{feeBasis}}. {{timing}}

{{closing}}

Kind regards,
{{signoff}}`,
    slots: {
      client:  { label: "Client name", type: "text", placeholder: "e.g. Jane Smith" },
      project: { label: "Project", type: "text", placeholder: "e.g. 14 Garden Tce landscape" },
      scope: {
        label: "Scope paragraph",
        default: "Full design",
        options: [
          { label: "Full design",
            text: "We will provide full landscape architectural services, from concept design through to documentation and construction observation." },
          { label: "Concept only",
            text: "We will provide concept landscape design, comprising a site analysis, a concept plan and an indicative planting palette for your review." },
          { label: "Planting plan only",
            text: "We will prepare a detailed planting plan and plant schedule, ready for pricing and installation." }
        ]
      },
      fee:      { label: "Fee amount", type: "text", placeholder: "e.g. $8,500" },
      feeBasis: { label: "Fee basis", default: "plus GST",
                  options: ["plus GST", "including GST", "as a fixed lump sum", "as an estimate only"] },
      timing: {
        label: "Timing line",
        default: "4-6 weeks",
        options: [
          { label: "4-6 weeks", text: "We expect to complete this work within four to six weeks of engagement." },
          { label: "By your date", text: "We are able to complete this work by your required date." },
          { label: "(none)", text: "" }
        ]
      },
      closing: {
        label: "Closing line",
        options: [
          "Please let me know if you would like to proceed, or if you have any questions.",
          "We would be delighted to work with you on this project.",
          "Happy to adjust the scope to suit your budget — just let me know."
        ]
      },
      signoff: { label: "Sign-off", type: "textarea",
                 default: "Aaron Troy\nPEOPL Landscape Architecture" }
    }
  },

  /* ----------------------------------------------------------- 2. PROJECT UPDATE */
  {
    id: "project-update",
    name: "Project update",
    subject: "{{project}} — update ({{stage}})",
    body:
`Hi {{client}},

A quick update on {{project}}.

We have now {{progress}}

{{next}}

{{closing}}

Kind regards,
{{signoff}}`,
    slots: {
      client:  { label: "Client name", type: "text", placeholder: "e.g. Jane" },
      project: { label: "Project", type: "text" },
      stage: { label: "Stage", default: "Concept",
               options: ["Concept", "Developed design", "Documentation", "Tender", "Construction"] },
      progress: {
        label: "Progress paragraph",
        options: [
          { label: "Concept complete",
            text: "completed the concept design and are ready to walk you through it. I've attached the concept plan for your initial review." },
          { label: "Issued for approval",
            text: "issued the drawings for your approval. We'll move to the next stage as soon as you're happy to sign off." },
          { label: "Started on site",
            text: "begun works on site. Things are progressing well and broadly to programme." }
        ]
      },
      next: {
        label: "Next steps",
        options: [
          { label: "Your review", text: "Next step is your feedback — happy to set up a call or meet on site to talk it through." },
          { label: "We proceed", text: "Next step is for us to progress the following stage; nothing needed from you right now." },
          { label: "Confirm trades", text: "Next step is to confirm timing with the contractor, and I'll keep you posted." }
        ]
      },
      closing: {
        label: "Closing line",
        options: [
          "Let me know if you have any questions.",
          "Give me a call any time to discuss.",
          "More soon."
        ]
      },
      signoff: { label: "Sign-off", type: "textarea",
                 default: "Aaron Troy\nPEOPL Landscape Architecture" }
    }
  }

];
