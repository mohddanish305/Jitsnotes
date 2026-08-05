import { Router } from "express";
import {
  addSubject,
  deleteSubject,
  updateSubject,
} from "../controllers/admin.controller.js";
import { requireAdmin, verifySupabaseJwt } from "../middleware/auth.middleware.js";

const router = Router();

router.use(verifySupabaseJwt, requireAdmin);

router.post("/subjects", addSubject);
router.put("/subjects/:id", updateSubject);
router.delete("/subjects/:id", deleteSubject);

export default router;

