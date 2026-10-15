import { exec } from "child_process";
import { log } from "console";
import readline from "readline";
import "dotenv/config";
import { env, stdin, stdout } from "process";
import moment from "moment";

const { DB_NAME, DB_USERNAME, DB_PASSWORD, DB_HOST, DB_PORT } = env;
const PG_DUMP_COMMAND = `pg_dump --username=${DB_USERNAME} --password=${DB_PASSWORD} --host=${DB_HOST} --port=${DB_PORT} --dbname=${DB_NAME} --verbose --format=plain --file=${process.cwd()}/opensimrs-backup-at-${moment().format(`DD-MM-YYYY`)}.sql `;
const rl = readline.createInterface({ input: stdin, output: stdout });



function asking() {
  rl.question(`Pastikan sebelum melakukan sinkornasi database \nanda telah melakukan backup database terlebih dahulu, \napakah anda sudah melakukan backup? (yes/no): `, (answer) => {
    if (!answer) asking();
    else {
      if (answer === "yes" || answer === "y") {
        syncronizeDatabase();
        rl.close();
      } else if (answer === "no" || answer === "n") {
        rl.question("apakah anda ingin melakukan backup otomatis? (yes/no): ", (answear) => {
          if (answear === "yes") {
            executePgDump();
            rl.close();
          } else {
            rl.close();
          }
        });
      }
    }
  });
}
asking();

const syncronizeDatabase = () => log("Syncronize......");
const executePgDump = () => {``
  exec(`echo "bekap database ototmatis...."`, (error, stdout, stderr) => {
    if (error) log(error);
    if (stderr) log(stderr);
    if(stderr) log(stdout)
  });
};