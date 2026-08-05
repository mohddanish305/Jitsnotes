import { Router } from "express";
import { getSubjectsByYear, getYears } from "../controllers/public.controller.js";

const router = Router();

router.get("/years", getYears);
router.get("/subjects/:yearId", getSubjectsByYear);

export default router;

