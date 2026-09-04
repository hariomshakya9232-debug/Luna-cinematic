api/auth.js
import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const sql = neon(process.env.DATABASE_URL);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, originalHash] = stored.split(":");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(originalHash, "hex")
  );
}

export default async function handler(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://hariomshakya9232-debug.github.io"
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { action, name, email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required"
      });
    }

    // Create users table automatically
    await sql`
      CREATE TABLE IF NOT EXISTS luna_users (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        credits INTEGER NOT NULL DEFAULT 5,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const cleanEmail = email.trim().toLowerCase();

    // SIGNUP
    if (action === "signup") {
      if (!name || name.trim().length < 2) {
        return res.status(400).json({
          error: "Name is required"
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          error: "Password must be at least 6 characters"
        });
      }

      const existing = await sql`
        SELECT id FROM luna_users
        WHERE email = ${cleanEmail}
        LIMIT 1
      `;

      if (existing.length) {
        return res.status(409).json({
          error: "Account already exists"
        });
      }

      const passwordHash = hashPassword(password);

      const result = await sql`
        INSERT INTO luna_users
          (name, email, password_hash, credits)
        VALUES
          (${name.trim()}, ${cleanEmail}, ${passwordHash}, 5)
        RETURNING id, name, email, credits
      `;

      return res.status(201).json({
        success: true,
        message: "Account created successfully",
        user: result[0]
      });
    }

    // LOGIN
    if (action === "login") {
      const users = await sql`
        SELECT id, name, email, password_hash, credits
        FROM luna_users
        WHERE email = ${cleanEmail}
        LIMIT 1
      `;

      if (!users.length) {
        return res.status(401).json({
          error: "Invalid email or password"
        });
      }

      const user = users[0];

      if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({
          error: "Invalid email or password"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          credits: user.credits
        }
      });
    }

    return res.status(400).json({
      error: "Invalid action"
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Server error"
    });
  }
}
