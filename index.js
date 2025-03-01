require("dotenv").config();
const express = require("express");
const postgres = require("postgres");
const cors = require("cors");
var sha256 = require("js-sha256");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((_, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID } = process.env;

const sql = postgres({
  host: PGHOST,
  database: PGDATABASE,
  username: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: "require",
  connection: {
    options: `project=${ENDPOINT_ID}`,
  },
});

//Products request
//Get all products & Searech by name & brand
app.get("/products", async (req, res) => {
  try {
    let name = req.query.name;
    let brand = req.query.brand;
    name = name ? name.toLowerCase() : "";
    brand = brand ? brand.toLowerCase() : "";
    let query = sql`SELECT * FROM products`;
    if (!brand & !name) {
      query = await sql`SELECT * FROM products`;
      res.send(query);
    } else if (name) {
      query = await sql`${query} WHERE LOWER(name) LIKE '%' || ${name} || '%'`;
      res.send(query);
    } else if (brand) {
      console.log(`${query} WHERE LOWER(brand) LIKE '%' || ${brand} || '%'`);
      query =
        await sql`${query} WHERE LOWER(brand) LIKE '%' || ${brand} || '%'`;
      res.send(query);
    } else if (req.query.sort) {
      query = await sql`SELECT * FROM products ORDER BY price`;
      res.send(query);
    }
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

//Get product with id
app.get("/products/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    let query = await sql`SELECT * FROM products WHERE id = ${productId}`;
    res.send(query);
  } catch (error) {
    res.status(500);
  }
});

//delete products
app.delete("/products/:id", async (req, res) => {
  const productId = req.params.id;
  try {
    await sql`UPDATE sales SET product_id = NULL WHERE product_id = ${productId}`;
    const query = await sql`DELETE FROM products WHERE id = ${productId}`;
    res.send(query);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
    console.log("Error deleting product:", error);
  }
});

//Create new prouducts
app.post("/products", async (req, res) => {
  try {
    const { brand, name, description, amount, category, price, product_image } =
      req.body;
    const query =
      await sql`INSERT INTO products (brand, name, description, amount, category, price, product_image) VALUES ( ${brand}, ${name}, ${description}, ${amount},${category},${price},${product_image})`;
    console.log(query);
    res.status(200).send(query);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
    console.log("Error to create product:", error);
  }
});

//Edit product
app.put("/products/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const { amount, price } = req.body;

    const query =
      await sql`UPDATE products SET amount = ${amount}, price = ${price} WHERE id = ${productId}`;

    res.send(query);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
    console.error("Error updating product:", error);
  }
});

//change amount
app.patch("/products/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const { amount } = req.body;

    const query =
      await sql`UPDATE products SET amount = ${amount} WHERE id = ${productId}`;

    res.send(query);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
    console.error("Error updating product:", error);
  }
});

//User request
//Get user
app.get("/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    let query = await sql`SELECT * FROM users WHERE id = ${userId}`;
    res.send(query);
  } catch (error) {
    res.status(500);
  }
});

//Login
app.post("/users", async (req, res) => {
  try {
    const { username, password } = req.body;
    const enPass = sha256(password);
    const validUser =
      await sql`SELECT * FROM users WHERE username = ${username} AND password = ${enPass} `;
    if (validUser && validUser.length > 0) {
      res.send({
        user: {
          id: validUser[0].id,
          username: validUser[0].username,
          is_admin: validUser[0].is_admin,
        },
      });
    } else if (!(username === username) && !(password === password)) {
      res.status(401).json({ message: "Wrong username and/or password" });
    }
    else if (username.length > 0 && password.length > 0) {
      const newUser = await sql`INSERT INTO users (username, password, is_admin) VALUES (${username}, ${enPass}, false) RETURNING *`;
      res.status(201).json({ message: 'User created successfully', user: { error: newUser[0].username, password: newUser[0].password } });
      console.log("new", newUser);
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
//sing up
// app.post("/users/:id", async (req, res) => {
//   try {
//     const userId = req.params.id;
//     const { username, password } = req.body;
//     const enPass = sha256(password);
//     const validUser = await sql`SELECT * FROM users WHERE id = ${userId}`;
//     if (!validUser) {
//       const newUser =
//         await sql`INSERT INTO users (username, password, is_admin) VALUES (${username}, ${enPass}, false) RETURNING *`;
//       res
//         .status(201)
//         .json({
//           message: "User created successfully",
//           user: { error: newUser[0].username, password: newUser[0].password },
//         });
//       console.log("new", newUser);
//     } else {
//       res.status(500).json({ message: "user already dose exist" });
//     }
//   } catch (error) {
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

//sales
app.post("/sales", async (req, res) => {
  const { user_id, product_id } = req.body;
  try {
    const query = await sql`
      INSERT INTO sales (user_id, product_id)
      VALUES (${user_id}, ${product_id})
    `;
    res.send(query);
  } catch (error) {
    console.error("Error adding sales:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

app.listen(process.env.PORT, () =>
  console.log(` My App listening at http://localhost:${process.env.PORT}`)
);
