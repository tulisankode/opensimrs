import fs from "fs/promises";

export default async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error(`Error saat menghapus file ${filePath}:`, error);
  }
}
