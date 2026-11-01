# Maja Space: question papers

This branch holds copies of the Tamil Nadu State Board Class 12 question papers that the Maja Space app shows:
public exam papers (March and June/July), the district quarterly and half-yearly exams, the PTA model
question book and the DGE model paper, for Maths, Physics, Chemistry and Biology (`M/`, `P/`, `C/`, `B/`).

They were collected from the pages that list them on padasalai.net and trbtnpsc.com. `index.json` gives,
for every file, the site it was published on, who shared it, the original address, its size and SHA-256.
The app reads these copies first, so a paper still opens if the original page moves, and falls back to the
original address if a copy can't be reached. Model papers written by teachers are not copied: the app
opens them from where their authors published them.

This branch is separate from the app's update files on `main`. To work on `main` only, clone with
`git clone --single-branch --branch main https://github.com/majaspacebroskies/maja-space-app`.
