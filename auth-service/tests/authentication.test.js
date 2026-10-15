import { expect } from "@jest/globals";
import supertest from "supertest";
import app from "../src/app";
import bcrypt from "bcryptjs";
import { uuidv7 } from "uuidv7";
describe("API /v1/authentication", () => {
  test("should can login", async () => {
    const response = await supertest(app)
      .post("/v1/authenticate")
      .send({
        username: "",
        password: "",
      })
      .set({
        "content-type": "application/json",
        accept: "application/json",
      });
  });
  
  it('shoud can decript', async () => {
    const password = "secreetPass";
    const hasgPassword = await bcrypt.hash(password, 10);
    console.log(hasgPassword);
  });

  it('helper', async () => {
    console.log(uuidv7());
  });
});
