import("./src/cssd/rute.js")
  .then(() => console.log("IMPORT_OK"))
  .catch((e) => {
    console.error("IMPORT_FAIL", e);
    process.exit(1);
  });
