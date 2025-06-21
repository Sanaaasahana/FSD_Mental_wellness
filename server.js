const express = require("express")
const { Pool } = require("pg")
const bcrypt = require("bcrypt")
const session = require("express-session")
const path = require("path")

const app = express()
const port = process.env.PORT || 3000

// Database connection with better error handling for Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

// Test database connection on startup
async function testDatabaseConnection() {
  try {
    const result = await pool.query("SELECT NOW()")
    console.log("✅ Database connected successfully at:", result.rows[0].now)
    return true
  } catch (error) {
    console.error("❌ Database connection failed:", error.message)
    console.error("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not set")
    return false
  }
}

// Middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname)))

app.use(
  session({
    secret: process.env.SESSION_SECRET || "mindful-space-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production" ? false : false, // Set to true if using HTTPS
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
)

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next()
  } else {
    res.status(401).json({ message: "Authentication required" })
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

// Routes

// Serve HTML files
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"))
})

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"))
})

app.get("/home.html", (req, res) => {
  res.sendFile(path.join(__dirname, "home.html"))
})

app.get("/journal.html", (req, res) => {
  res.sendFile(path.join(__dirname, "journal.html"))
})

app.get("/support-group.html", (req, res) => {
  res.sendFile(path.join(__dirname, "support-group.html"))
})

app.get("/connect.html", (req, res) => {
  res.sendFile(path.join(__dirname, "connect.html"))
})

app.get("/profile.html", (req, res) => {
  res.sendFile(path.join(__dirname, "profile.html"))
})

// Auth routes with better error handling
app.post("/api/signup", async (req, res) => {
  try {
    console.log("Signup request received:", { ...req.body, password: "[HIDDEN]" })

    const { name, email, password, birthdate } = req.body

    if (!name || !email || !password || !birthdate) {
      return res.status(400).json({ message: "All fields are required" })
    }

    // Check if user already exists
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email])
    if (existingUser.rows.length > 0) {
      console.log("User already exists:", email)
      return res.status(400).json({ message: "User already exists" })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const result = await pool.query(
      "INSERT INTO users (name, email, password, birthdate) VALUES ($1, $2, $3, $4) RETURNING id, name, email",
      [name, email, hashedPassword, birthdate],
    )

    console.log("User created successfully:", result.rows[0])
    res.status(201).json({ message: "User created successfully", user: result.rows[0] })
  } catch (error) {
    console.error("Signup error:", error)
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : "Database error",
    })
  }
})

app.post("/api/login", async (req, res) => {
  try {
    console.log("Login request received for:", req.body.email)

    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" })
    }

    // Find user
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    const user = result.rows[0]

    // Check password
    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    // Set session
    req.session.userId = user.id
    console.log("User logged in successfully:", user.email)

    res.json({ message: "Login successful", user: { id: user.id, name: user.name, email: user.email } })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err)
      return res.status(500).json({ message: "Could not log out" })
    }
    res.json({ message: "Logged out successfully" })
  })
})

// User routes
app.get("/api/user", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, birthdate, bio FROM users WHERE id = $1", [
      req.session.userId,
    ])

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error("Get user error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.put("/api/user/profile", requireAuth, async (req, res) => {
  try {
    const { name, email, birthdate, bio } = req.body

    const result = await pool.query(
      "UPDATE users SET name = $1, email = $2, birthdate = $3, bio = $4 WHERE id = $5 RETURNING id, name, email, birthdate, bio",
      [name, email, birthdate, bio, req.session.userId],
    )

    res.json(result.rows[0])
  } catch (error) {
    console.error("Update profile error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.put("/api/user/password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    // Get current user
    const userResult = await pool.query("SELECT password FROM users WHERE id = $1", [req.session.userId])
    const user = userResult.rows[0]

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password)
    if (!validPassword) {
      return res.status(400).json({ message: "Current password is incorrect" })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, req.session.userId])

    res.json({ message: "Password updated successfully" })
  } catch (error) {
    console.error("Update password error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.get("/api/user/stats", requireAuth, async (req, res) => {
  try {
    const stats = await pool.query(
      `
            SELECT 
                COUNT(CASE WHEN j.user_id = $1 THEN 1 END) as total_entries,
                COUNT(CASE WHEN j.user_id = $1 AND j.is_public = true THEN 1 END) as public_entries,
                COUNT(DISTINCT CASE WHEN (c.user1_id = $1 OR c.user2_id = $1) AND c.status = 'accepted' THEN 
                    CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END 
                END) as total_connections,
                COUNT(DISTINCT DATE(j.created_at)) as days_active
            FROM users u
            LEFT JOIN journal_entries j ON j.user_id = u.id OR j.user_id = $1
            LEFT JOIN connections c ON (c.user1_id = $1 OR c.user2_id = $1)
            WHERE u.id = $1
            GROUP BY u.id
        `,
      [req.session.userId],
    )

    res.json(stats.rows[0] || { total_entries: 0, public_entries: 0, total_connections: 0, days_active: 0 })
  } catch (error) {
    console.error("Get stats error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Mood routes
app.post("/api/mood", requireAuth, async (req, res) => {
  try {
    const { mood, emoji } = req.body
    const today = new Date().toISOString().split("T")[0]

    // Check if mood already exists for today
    const existing = await pool.query("SELECT id FROM moods WHERE user_id = $1 AND date = $2", [
      req.session.userId,
      today,
    ])

    if (existing.rows.length > 0) {
      // Update existing mood
      await pool.query("UPDATE moods SET mood = $1, emoji = $2 WHERE user_id = $3 AND date = $4", [
        mood,
        emoji,
        req.session.userId,
        today,
      ])
    } else {
      // Insert new mood
      await pool.query("INSERT INTO moods (user_id, date, mood, emoji) VALUES ($1, $2, $3, $4)", [
        req.session.userId,
        today,
        mood,
        emoji,
      ])
    }

    res.json({ message: "Mood saved successfully" })
  } catch (error) {
    console.error("Save mood error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.get("/api/moods", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT date, mood, emoji FROM moods WHERE user_id = $1 ORDER BY date DESC", [
      req.session.userId,
    ])
    res.json(result.rows)
  } catch (error) {
    console.error("Get moods error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Gratitude routes
app.post("/api/gratitude", requireAuth, async (req, res) => {
  try {
    const { text } = req.body

    await pool.query("INSERT INTO gratitude (user_id, text) VALUES ($1, $2)", [req.session.userId, text])

    res.json({ message: "Gratitude saved successfully" })
  } catch (error) {
    console.error("Save gratitude error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.get("/api/gratitude", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT text, created_at FROM gratitude WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
      [req.session.userId],
    )
    res.json(result.rows)
  } catch (error) {
    console.error("Get gratitude error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Journal routes
app.post("/api/journal", requireAuth, async (req, res) => {
  try {
    const { title, content, category, is_public } = req.body

    await pool.query(
      "INSERT INTO journal_entries (user_id, title, content, category, is_public) VALUES ($1, $2, $3, $4, $5)",
      [req.session.userId, title, content, category, is_public],
    )

    res.json({ message: "Journal entry saved successfully" })
  } catch (error) {
    console.error("Save journal error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.get("/api/journal", requireAuth, async (req, res) => {
  try {
    const { category } = req.query
    let query = "SELECT * FROM journal_entries WHERE user_id = $1"
    const params = [req.session.userId]

    if (category) {
      query += " AND category = $2"
      params.push(category)
    }

    query += " ORDER BY created_at DESC"

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (error) {
    console.error("Get journal entries error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.delete("/api/journal/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    await pool.query("DELETE FROM journal_entries WHERE id = $1 AND user_id = $2", [id, req.session.userId])

    res.json({ message: "Journal entry deleted successfully" })
  } catch (error) {
    console.error("Delete journal entry error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Public journal routes
app.get("/api/public-journal", requireAuth, async (req, res) => {
  try {
    const { category } = req.query
    let query = `
            SELECT j.*, u.name as author_name, 
                   COUNT(l.id) as likes
            FROM journal_entries j
            JOIN users u ON j.user_id = u.id
            LEFT JOIN journal_likes l ON j.id = l.journal_id
            WHERE j.is_public = true
        `
    const params = []

    if (category) {
      query += " AND j.category = $1"
      params.push(category)
    }

    query += " GROUP BY j.id, u.name ORDER BY j.created_at DESC"

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (error) {
    console.error("Get public journal entries error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.post("/api/journal/:id/like", requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    // Check if already liked
    const existing = await pool.query("SELECT id FROM journal_likes WHERE journal_id = $1 AND user_id = $2", [
      id,
      req.session.userId,
    ])

    if (existing.rows.length === 0) {
      await pool.query("INSERT INTO journal_likes (journal_id, user_id) VALUES ($1, $2)", [id, req.session.userId])
    }

    res.json({ message: "Entry liked successfully" })
  } catch (error) {
    console.error("Like entry error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Comments routes
app.get("/api/journal/:id/comments", requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      `
            SELECT c.*, u.name as author_name
            FROM journal_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.journal_id = $1
            ORDER BY c.created_at ASC
        `,
      [id],
    )

    res.json(result.rows)
  } catch (error) {
    console.error("Get comments error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.post("/api/journal/:id/comments", requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { content } = req.body

    await pool.query("INSERT INTO journal_comments (journal_id, user_id, content) VALUES ($1, $2, $3)", [
      id,
      req.session.userId,
      content,
    ])

    res.json({ message: "Comment added successfully" })
  } catch (error) {
    console.error("Add comment error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Connection routes
app.get("/api/users", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
            SELECT u.id, u.name, u.created_at,
                   COUNT(j.id) as public_entries_count
            FROM users u
            LEFT JOIN journal_entries j ON u.id = j.user_id AND j.is_public = true
            WHERE u.id != $1
            AND u.id NOT IN (
                SELECT CASE WHEN user1_id = $1 THEN user2_id ELSE user1_id END
                FROM connections 
                WHERE (user1_id = $1 OR user2_id = $1) AND status = 'accepted'
            )
            AND u.id NOT IN (
                SELECT receiver_id FROM connection_requests WHERE sender_id = $1 AND status = 'pending'
            )
            GROUP BY u.id, u.name, u.created_at
            ORDER BY u.name
        `,
      [req.session.userId],
    )

    res.json(result.rows)
  } catch (error) {
    console.error("Get users error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.post("/api/connection-request", requireAuth, async (req, res) => {
  try {
    const { receiver_id } = req.body

    // Check if request already exists
    const existing = await pool.query("SELECT id FROM connection_requests WHERE sender_id = $1 AND receiver_id = $2", [
      req.session.userId,
      receiver_id,
    ])

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Connection request already sent" })
    }

    await pool.query("INSERT INTO connection_requests (sender_id, receiver_id) VALUES ($1, $2)", [
      req.session.userId,
      receiver_id,
    ])

    res.json({ message: "Connection request sent successfully" })
  } catch (error) {
    console.error("Send connection request error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.get("/api/connection-requests", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
            SELECT cr.*, u.name as sender_name
            FROM connection_requests cr
            JOIN users u ON cr.sender_id = u.id
            WHERE cr.receiver_id = $1 AND cr.status = 'pending'
            ORDER BY cr.created_at DESC
        `,
      [req.session.userId],
    )

    res.json(result.rows)
  } catch (error) {
    console.error("Get connection requests error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.post("/api/connection-request/:id/accept", requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    // Get the request
    const requestResult = await pool.query(
      "SELECT sender_id FROM connection_requests WHERE id = $1 AND receiver_id = $2",
      [id, req.session.userId],
    )

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: "Connection request not found" })
    }

    const senderId = requestResult.rows[0].sender_id

    // Create connection
    await pool.query("INSERT INTO connections (user1_id, user2_id, status) VALUES ($1, $2, $3)", [
      Math.min(req.session.userId, senderId),
      Math.max(req.session.userId, senderId),
      "accepted",
    ])

    // Update request status
    await pool.query("UPDATE connection_requests SET status = $1 WHERE id = $2", ["accepted", id])

    res.json({ message: "Connection request accepted" })
  } catch (error) {
    console.error("Accept connection request error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.post("/api/connection-request/:id/reject", requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    await pool.query("UPDATE connection_requests SET status = $1 WHERE id = $2 AND receiver_id = $3", [
      "rejected",
      id,
      req.session.userId,
    ])

    res.json({ message: "Connection request rejected" })
  } catch (error) {
    console.error("Reject connection request error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.get("/api/connections", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
            SELECT 
                CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END as id,
                CASE WHEN c.user1_id = $1 THEN u2.name ELSE u1.name END as name,
                c.created_at as connected_at
            FROM connections c
            JOIN users u1 ON c.user1_id = u1.id
            JOIN users u2 ON c.user2_id = u2.id
            WHERE (c.user1_id = $1 OR c.user2_id = $1) AND c.status = 'accepted'
            ORDER BY c.created_at DESC
        `,
      [req.session.userId],
    )

    res.json(result.rows)
  } catch (error) {
    console.error("Get connections error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

app.delete("/api/connection/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    await pool.query(
      "DELETE FROM connections WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)",
      [req.session.userId, id],
    )

    res.json({ message: "Connection removed successfully" })
  } catch (error) {
    console.error("Remove connection error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack)
  res.status(500).json({ message: "Something went wrong!" })
})

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  console.log("404 - API route not found:", req.path)
  res.status(404).json({ message: "API endpoint not found" })
})

// 404 handler for other routes
app.use((req, res) => {
  console.log("404 - Page not found:", req.path)
  res.status(404).send("Page not found")
})

// Start server with database connection test
app.listen(port, async () => {
  console.log(`🚀 Server running on port ${port}`)
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`)

  // Test database connection
  const dbConnected = await testDatabaseConnection()
  if (!dbConnected) {
    console.log("⚠️  Database not connected. Please check your DATABASE_URL environment variable.")
  } else {
    console.log("✅ Application ready!")
  }
})
