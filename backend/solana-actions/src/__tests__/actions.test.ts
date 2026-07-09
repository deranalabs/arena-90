import supertest from "supertest";

import { app, server } from "../index";

describe("Solana Actions API", () => {
  afterAll(() => {
    server.close();
  });

  it("should return rules for actions.json GET", async () => {
    const response = await supertest(app).get("/actions.json");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.body).toEqual({
      rules: [
        {
          pathPattern: "/arena",
          apiPath: "/api/actions/arena",
        },
        {
          pathPattern: "/api/actions/arena",
          apiPath: "/api/actions/arena",
        },
      ],
    });
  });

  it("should generate a valid transaction on POST /api/actions/arena", async () => {
    // Generate a valid mock address for testing
    const mockAccount = "5ZWbJ8c6X95UhyK715rBf5f3hC1e66C7U7N4c1jW3SjY"; // Random public key format

    const response = await supertest(app)
      .post("/api/actions/arena?agent=isagi")
      .send({ account: mockAccount });

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.body).toHaveProperty("transaction");
    expect(response.body).toHaveProperty("message");
    expect(response.body.message).toContain("Stake");
    expect(response.body.message).toContain("ISAGI");
    // Ensure the returned transaction string can at least be parsed (or is non-empty)
    expect(typeof response.body.transaction).toBe("string");
    expect(response.body.transaction.length).toBeGreaterThan(10);
  });

  it("should fail POST if an invalid agent is queried", async () => {
    const mockAccount = "5ZWbJ8c6X95UhyK715rBf5f3hC1e66C7U7N4c1jW3SjY";
    const response = await supertest(app)
      .post("/api/actions/arena?agent=invalid_agent")
      .send({ account: mockAccount });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: "agent query must be either 'isagi' or 'aiku'",
    });
  });
});

