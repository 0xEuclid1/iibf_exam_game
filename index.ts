import express from "express";
const app = express();
const port = 3005;

app.get("/", (req, res) => {
  res.send("Hello CodeSandbox!");
});

app.listen(port, () => {
  console.log(`Sandbox listening on port ${port}`);
});
