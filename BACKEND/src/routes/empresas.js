
const express = require("express");
const { pool } = require("../db");
const jwt = require("jsonwebtoken");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "inseguro";

function getUserFromAuthHeader(req) {
  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = auth.substring(7);
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function getUsuarioId(authUser) {
  if (!authUser) {
    return null;
  }

  const id =
    authUser.usuarioId ??
    authUser.usuario_id ??
    authUser.usuario?.id ??
    authUser.id;

  const usuarioId = Number(id);

  return Number.isInteger(usuarioId) && usuarioId > 0
    ? usuarioId
    : null;
}

// Crear empresa (con usuario y relación, o solo empresa)
router.post("/", async (req, res) => {
  const { usuario, empresa } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Registro con usuario y empresa
    if (usuario && empresa) {
      const {
        nombre_usuario,
        contrasena_hash,
        correo: correoUsuario,
      } = usuario;

      const {
        nombre,
        direccion = null,
        telefono = null,
        correo,
      } = empresa;

      const usuarioResult = await client.query(
        `INSERT INTO usuarios
          (nombre_usuario, contrasena_hash, correo)
         VALUES ($1, $2, $3)
         RETURNING id, nombre_usuario, correo, created_at`,
        [nombre_usuario, contrasena_hash, correoUsuario]
      );

      const usuarioId = usuarioResult.rows[0].id;

      const empresaResult = await client.query(
        `INSERT INTO empresas (nombre, direccion, telefono, correo)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [nombre, direccion, telefono, correo]
      );

      const empresaId = empresaResult.rows[0].id;

      await client.query(
        `INSERT INTO empresa_usuarios
          (empresa_id, usuario_id, rol_id)
         VALUES ($1, $2, $3)`,
        [empresaId, usuarioId, 1]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        usuario: usuarioResult.rows[0],
        empresa: empresaResult.rows[0],
      });
    }

    // Registro de una empresa con un usuario autenticado
    const { nombre, direccion = null, telefono = null, correo } = req.body;

    const authUser = getUserFromAuthHeader(req);
    const usuarioId = getUsuarioId(authUser);

    if (!usuarioId) {
      await client.query("ROLLBACK");
      return res.status(401).json({
        error: "No se pudo identificar al usuario para registrar la auditoría",
      });
    }

    const result = await client.query(
      `INSERT INTO empresas (nombre, direccion, telefono, correo)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre, direccion, telefono, correo]
    );

    await client.query(
      `INSERT INTO auditoria (usuario_id, accion)
       VALUES ($1, $2)`,
      [usuarioId, `EMPRESAS_CREAR: creó empresa ${nombre}`]
    );

    await client.query("COMMIT");

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al crear empresa:", err);

    return res.status(500).json({
      error: "Error al crear empresa",
      glosa: err.message || err.toString(),
    });
  } finally {
    client.release();
  }
});

// Listar empresas
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM empresas ORDER BY id DESC"
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error al listar empresas:", err);

    res.status(500).json({
      error: "Error al listar empresas",
      glosa: err.message || err.toString(),
    });
  }
});

// Obtener empresa por ID
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM empresas WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al obtener empresa:", err);

    res.status(500).json({
      error: "Error al obtener empresa",
      glosa: err.message || err.toString(),
    });
  }
});

// Actualizar empresa
router.put("/:id", async (req, res) => {
  const { nombre, direccion = null, telefono = null, correo } = req.body;

  const authUser = getUserFromAuthHeader(req);
  const usuarioId = getUsuarioId(authUser);

  if (!usuarioId) {
    return res.status(401).json({
      error: "No se pudo identificar al usuario para registrar la auditoría",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE empresas
       SET nombre = $1, direccion = $2, telefono = $3, correo = $4
       WHERE id = $5
       RETURNING *`,
      [nombre, direccion, telefono, correo, req.params.id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No encontrado" });
    }

    await client.query(
      `INSERT INTO auditoria (usuario_id, accion)
       VALUES ($1, $2)`,
      [
        usuarioId,
        `EMPRESAS_ACTUALIZAR: actualizó empresa ID ${req.params.id}`,
      ]
    );

    await client.query("COMMIT");

    return res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al actualizar empresa:", err);

    return res.status(500).json({
      error: "Error al actualizar empresa",
      glosa: err.message || err.toString(),
    });
  } finally {
    client.release();
  }
});

// Eliminar empresa
router.delete("/:id", async (req, res) => {
  const authUser = getUserFromAuthHeader(req);
  const usuarioId = getUsuarioId(authUser);

  if (!usuarioId) {
    return res.status(401).json({
      error: "No se pudo identificar al usuario para registrar la auditoría",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      "DELETE FROM empresas WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No encontrado" });
    }

    await client.query(
      `INSERT INTO auditoria (usuario_id, accion)
       VALUES ($1, $2)`,
      [
        usuarioId,
        `EMPRESAS_ELIMINAR: eliminó empresa ID ${req.params.id}`,
      ]
    );

    await client.query("COMMIT");

    return res.json({ deleted: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al eliminar empresa:", err);

    return res.status(500).json({
      error: "Error al eliminar empresa",
      glosa: err.message || err.toString(),
    });
  } finally {
    client.release();
  }
});

module.exports = router;
