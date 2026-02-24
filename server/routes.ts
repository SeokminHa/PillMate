import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const MFDS_BASE = "https://apis.data.go.kr/1471000";

function buildMfdsUrl(endpoint: string, serviceKey: string, params: Record<string, string>): string {
  const paramParts: string[] = [];
  paramParts.push(`type=json`);
  for (const [k, v] of Object.entries(params)) {
    paramParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return `${MFDS_BASE}/${endpoint}?serviceKey=${serviceKey}&${paramParts.join("&")}`;
}

async function fetchMfds(endpoint: string, params: Record<string, string>) {
  const rawKey = process.env.MFDS_API_KEY;
  if (!rawKey) {
    throw new Error("MFDS_API_KEY is not configured");
  }

  const serviceKey = rawKey.trim();
  const hasPercent = serviceKey.includes("%");
  const hasPlus = serviceKey.includes("+");
  const hasSlash = serviceKey.includes("/");
  const hasEqual = serviceKey.includes("=");
  console.log(`MFDS key: len=${serviceKey.length}, has%=${hasPercent}, has+=${hasPlus}, has/=${hasSlash}, has==${hasEqual}, first4=${serviceKey.slice(0, 4)}, last4=${serviceKey.slice(-4)}`);

  const attempts: Array<{ label: string; key: string }> = [];

  if (hasPercent) {
    attempts.push({ label: "raw(already-encoded)", key: serviceKey });
    try {
      const dec = decodeURIComponent(serviceKey);
      attempts.push({ label: "decoded-then-re-encoded", key: encodeURIComponent(dec) });
    } catch {}
  } else {
    attempts.push({ label: "encode-raw", key: encodeURIComponent(serviceKey) });
    attempts.push({ label: "raw-as-is", key: serviceKey });
  }

  let lastRes: globalThis.Response | null = null;
  for (const { label, key } of attempts) {
    const url = buildMfdsUrl(endpoint, key, params);
    console.log(`  trying ${label}: serviceKey prefix=${key.slice(0, 20)}...`);
    const res = await fetch(url);
    if (res.ok) return res.json();
    const body = await res.text().catch(() => "");
    console.log(`  ${label} => ${res.status}: ${body.slice(0, 100)}`);
    lastRes = res;
  }

  throw new Error(`MFDS API error: ${lastRes?.status} ${lastRes?.statusText}`);
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/drug/search", async (req: Request, res: Response) => {
    try {
      const name = (req.query.name as string || "").trim();
      if (!name) {
        return res.status(400).json({ error: "name parameter is required" });
      }

      const pageNo = req.query.pageNo as string || "1";
      const numOfRows = req.query.numOfRows as string || "10";

      const data = await fetchMfds(
        "DrbEasyDrugInfoService/getDrbEasyDrugList",
        { itemName: name, pageNo, numOfRows }
      );

      const body = data?.body;
      const items = body?.items ?? [];
      const totalCount = body?.totalCount ?? 0;

      res.json({ items, totalCount });
    } catch (err: any) {
      console.error("Drug search error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/drug/dur", async (req: Request, res: Response) => {
    try {
      const name = (req.query.name as string || "").trim();
      if (!name) {
        return res.status(400).json({ error: "name parameter is required" });
      }

      const results: Record<string, any[]> = {};

      const endpoints = [
        { key: "contraindication", path: "DURPrdlstInfoService03/getUsjntTabooInfoList03", param: "itemName" },
        { key: "age", path: "DURPrdlstInfoService03/getSpcifyAgrdeTabooInfoList03", param: "itemName" },
        { key: "pregnancy", path: "DURPrdlstInfoService03/getPwnmTabooInfoList03", param: "itemName" },
      ];

      await Promise.all(
        endpoints.map(async ({ key, path, param }) => {
          try {
            const data = await fetchMfds(path, { [param]: name, pageNo: "1", numOfRows: "10" });
            const items = data?.body?.items ?? [];
            results[key] = items;
          } catch {
            results[key] = [];
          }
        })
      );

      res.json(results);
    } catch (err: any) {
      console.error("DUR search error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
