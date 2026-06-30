import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { pool } from "./db";
import { storage } from "./storage";
import { sendPushNotification } from "./push";

async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, any>): Promise<void> {
  try {
    const token = await storage.getUserPushToken(userId);
    if (token) await sendPushNotification(token, title, body, data);
  } catch {}
}

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}


function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        pool: pool as any,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "pillmate-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password, displayName, timezone } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "Username, password, and display name are required" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }
      const user = await storage.createUser({ username, password, displayName, timezone });
      req.session.userId = user.id;
      res.json({ id: user.id, username: user.username, displayName: user.displayName, timezone: user.timezone });
    } catch (err: any) {
      console.error("Register error:", err.message);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.userId = user.id;
      res.json({ id: user.id, username: user.username, displayName: user.displayName, timezone: user.timezone });
    } catch (err: any) {
      console.error("Login error:", err.message);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json({ id: user.id, username: user.username, displayName: user.displayName, timezone: user.timezone });
  });

  app.put("/api/auth/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { displayName, timezone, username } = req.body;
      const updateData: Partial<{ displayName: string; timezone: string; username: string }> = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (timezone !== undefined) updateData.timezone = timezone;
      if (username !== undefined) {
        const normalized = String(username).trim();
        if (!normalized) return res.status(400).json({ message: "Username required" });
        const existing = await storage.getUserByUsername(normalized);
        if (existing && existing.id !== req.session.userId) {
          return res.status(409).json({ message: "Username already taken" });
        }
        updateData.username = normalized;
      }
      const user = await storage.updateUser(req.session.userId!, updateData);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ id: user.id, username: user.username, displayName: user.displayName, timezone: user.timezone });
    } catch (err: any) {
      res.status(500).json({ message: "Update failed" });
    }
  });

  // Push token
  app.post("/api/push-token", requireAuth, async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ message: "Token is required" });
      await storage.updatePushToken(req.session.userId!, token);
      res.json({ message: "Token registered" });
    } catch {
      res.status(500).json({ message: "Failed to register token" });
    }
  });

  app.delete("/api/push-token", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.updatePushToken(req.session.userId!, null);
      res.json({ message: "Token removed" });
    } catch {
      res.status(500).json({ message: "Failed to remove token" });
    }
  });

  app.get("/api/medications", requireAuth, async (req: Request, res: Response) => {
    const meds = await storage.getMedications(req.session.userId!);
    res.json(meds);
  });

  app.post("/api/medications", requireAuth, async (req: Request, res: Response) => {
    try {
      const med = await storage.createMedication(req.session.userId!, req.body);
      res.json(med);
    } catch (err: any) {
      console.error("Create medication error:", err.message);
      res.status(500).json({ message: "Failed to create medication" });
    }
  });

  app.put("/api/medications/reorder", requireAuth, async (req: Request, res: Response) => {
    try {
      const { orderedIds } = req.body;
      await storage.reorderMedications(req.session.userId!, orderedIds);
      res.json({ message: "Reordered" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to reorder" });
    }
  });

  app.put("/api/medications/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getMedication(req.params.id);
      if (!existing) return res.status(404).json({ message: "Medication not found" });
      if (existing.userId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
      const med = await storage.updateMedication(req.params.id, req.body);
      res.json(med);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update medication" });
    }
  });

  app.delete("/api/medications/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getMedication(req.params.id);
      if (!existing) return res.status(404).json({ message: "Medication not found" });
      if (existing.userId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteMedication(req.params.id);
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete medication" });
    }
  });

  app.get("/api/dose-logs", requireAuth, async (req: Request, res: Response) => {
    const date = req.query.date as string | undefined;
    const logs = await storage.getDoseLogs(req.session.userId!, date);
    res.json(logs);
  });

  app.post("/api/dose-logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const { medicationId } = req.body;
      if (medicationId) {
        const med = await storage.getMedication(medicationId);
        if (!med || med.userId !== req.session.userId) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }
      const log = await storage.createDoseLog({
        ...req.body,
        userId: req.session.userId!,
      });
      res.json(log);
    } catch (err: any) {
      console.error("Create dose log error:", err.message);
      res.status(500).json({ message: "Failed to log dose" });
    }
  });

  app.delete("/api/dose-logs/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const log = await storage.getDoseLogById(req.params.id);
      if (!log) return res.status(404).json({ message: "Log not found" });
      if (log.userId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteDoseLog(req.params.id);
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete log" });
    }
  });

  app.get("/api/connections/pending-count", requireAuth, async (req: Request, res: Response) => {
    try {
      const conns = await storage.getConnections(req.session.userId!);
      const count = conns.filter(c => c.status === "pending" && c.targetId === req.session.userId).length;
      res.json({ count });
    } catch {
      res.json({ count: 0 });
    }
  });

  app.get("/api/connections", requireAuth, async (req: Request, res: Response) => {
    const conns = await storage.getConnections(req.session.userId!);
    const mapped = conns.map(c => ({
      id: c.id,
      status: c.status,
      nickname: c.nickname,
      createdAt: c.createdAt,
      requester: { id: c.requester.id, displayName: c.requester.displayName, timezone: c.requester.timezone },
      target: { id: c.target.id, displayName: c.target.displayName, timezone: c.target.timezone },
      isRequester: c.requesterId === req.session.userId,
      role: c.requesterId === req.session.userId ? "viewer" : "owner",
    }));
    res.json(mapped);
  });

  app.post("/api/connections/request", requireAuth, async (req: Request, res: Response) => {
    try {
      const { username, nickname } = req.body;
      if (!username || !username.trim()) {
        return res.status(400).json({ message: "Username is required" });
      }
      const myUserId = req.session.userId!;
      const target = await storage.getUserByUsername(username.trim());
      if (!target) {
        return res.status(404).json({ message: "User not found" });
      }
      if (target.id === myUserId) {
        return res.status(400).json({ message: "Cannot add yourself" });
      }

      const conns = await storage.getConnections(myUserId);
      const existing = conns.find(c =>
        (c.requesterId === myUserId && c.targetId === target.id) ||
        (c.targetId === myUserId && c.requesterId === target.id)
      );
      if (existing) {
        if (existing.status === "accepted") {
          return res.status(409).json({ message: "Already connected" });
        }
        if (existing.status === "pending") {
          return res.status(409).json({ message: "Request already pending" });
        }
        await storage.deleteConnection(existing.id);
      }

      const conn = await storage.createConnection(myUserId, target.id, nickname);
      const me = await storage.getUserById(myUserId);
      sendPushToUser(target.id, "Friend Request", `${me?.displayName || "Someone"} wants to connect with you`, { type: "friend_request" });
      res.json(conn);
    } catch (err: any) {
      console.error("Connection request error:", err.message);
      res.status(500).json({ message: "Failed to send request" });
    }
  });

  app.post("/api/connections/respond", requireAuth, async (req: Request, res: Response) => {
    try {
      const { connectionId, accept } = req.body;
      const conn = await storage.getConnectionById(connectionId);
      if (!conn) return res.status(404).json({ message: "Connection not found" });
      if (conn.targetId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
      const status = accept ? "accepted" : "rejected";
      const updated = await storage.updateConnectionStatus(connectionId, status);
      if (accept) {
        const me = await storage.getUserById(req.session.userId!);
        sendPushToUser(conn.requesterId, "Friend Request Accepted", `${me?.displayName || "Someone"} accepted your friend request`, { type: "friend_accepted" });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to respond" });
    }
  });

  app.delete("/api/connections/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const conn = await storage.getConnectionById(req.params.id);
      if (!conn) return res.status(404).json({ message: "Connection not found" });
      if (conn.requesterId !== req.session.userId && conn.targetId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteConnection(req.params.id);
      res.json({ message: "Disconnected" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to disconnect" });
    }
  });

  app.post("/api/invites", requireAuth, async (req: Request, res: Response) => {
    try {
      const invite = await storage.createInviteCode(req.session.userId!);
      res.json(invite);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  app.post("/api/invites/accept", requireAuth, async (req: Request, res: Response) => {
    try {
      const { code, nickname } = req.body;
      if (!code) return res.status(400).json({ message: "Code is required" });

      const invite = await storage.getInviteByCode(code);
      if (!invite) return res.status(404).json({ message: "Invalid invite code" });
      if (invite.usedBy) return res.status(400).json({ message: "Code already used" });
      if (new Date() > invite.expiresAt) return res.status(400).json({ message: "Code expired" });
      if (invite.userId === req.session.userId) return res.status(400).json({ message: "Cannot accept your own invite" });

      await storage.useInviteCode(code, req.session.userId!);
      const conn = await storage.createConnection(req.session.userId!, invite.userId, nickname);
      const accepted = await storage.updateConnectionStatus(conn.id, "accepted");
      res.json(accepted);
    } catch (err: any) {
      console.error("Accept invite error:", err.message);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  app.get("/api/summary/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const targetUserId = req.params.userId;
      const myUserId = req.session.userId!;

      if (targetUserId !== myUserId) {
        const conns = await storage.getConnections(myUserId);
        const hasAccess = conns.some(c =>
          c.status === "accepted" &&
          ((c.requesterId === myUserId && c.targetId === targetUserId) ||
           (c.targetId === myUserId && c.requesterId === targetUserId))
        );
        if (!hasAccess) {
          return res.status(403).json({ message: "Not authorized to view this user's data" });
        }
      }

      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
      const [summary, streak] = await Promise.all([
        storage.getUserSummary(targetUserId, date),
        storage.getUserStreak(targetUserId),
      ]);
      res.json({
        user: {
          id: summary.user.id,
          displayName: summary.user.displayName,
          timezone: summary.user.timezone,
        },
        streak,
        completed: summary.completed,
        pending: summary.pending,
        missed: summary.missed,
        total: summary.total,
        blockSummaries: summary.blockSummaries,
        items: summary.items,
      });
    } catch (err: any) {
      console.error("Summary error:", err.message);
      res.status(500).json({ message: "Failed to get summary" });
    }
  });

  app.post("/api/nudges", requireAuth, async (req: Request, res: Response) => {
    try {
      const { toUserId, type, medicationName, message } = req.body;
      const allowedTypes = ["reminder", "praise", "heart", "time"];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ message: "Invalid nudge type" });
      }
      const conns = await storage.getConnections(req.session.userId!);
      const hasAccess = conns.some(c =>
        c.status === "accepted" &&
        ((c.requesterId === req.session.userId && c.targetId === toUserId) ||
         (c.targetId === req.session.userId && c.requesterId === toUserId))
      );
      if (!hasAccess) return res.status(403).json({ message: "Not connected" });
      const cleanMessage = typeof message === "string" ? message.slice(0, 200) : null;
      const cleanMedName = typeof medicationName === "string" ? medicationName.slice(0, 100) : null;
      const nudge = await storage.createNudge(req.session.userId!, toUserId, type, cleanMedName, cleanMessage);
      const me = await storage.getUserById(req.session.userId!);
      const pushBody = cleanMessage || (type === "praise" ? "Great job! 👏" : "Time for your meds 💊");
      sendPushToUser(toUserId, `${me?.displayName || "Friend"}`, pushBody, { type: "nudge" });
      res.json(nudge);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to send nudge" });
    }
  });

  app.get("/api/nudges", requireAuth, async (req: Request, res: Response) => {
    const nudgeList = await storage.getNudges(req.session.userId!);
    res.json(nudgeList.map(n => ({
      id: n.id,
      type: n.type,
      medicationName: n.medicationName,
      message: n.message,
      fromUser: { id: n.fromUser.id, displayName: n.fromUser.displayName },
      createdAt: n.createdAt,
      readAt: n.readAt,
    })));
  });

  app.put("/api/nudges/:id/read", requireAuth, async (req: Request, res: Response) => {
    const nudge = await storage.getNudgeById(req.params.id);
    if (!nudge) return res.status(404).json({ message: "Nudge not found" });
    if (nudge.toUserId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
    await storage.markNudgeRead(req.params.id);
    res.json({ message: "Marked as read" });
  });

  // Group routes
  app.get("/api/groups/pending-count", requireAuth, async (req: Request, res: Response) => {
    try {
      const invites = await storage.getPendingGroupInvites(req.session.userId!);
      res.json({ count: invites.length });
    } catch {
      res.json({ count: 0 });
    }
  });

  app.get("/api/groups/pending-invites", requireAuth, async (req: Request, res: Response) => {
    try {
      const invites = await storage.getPendingGroupInvites(req.session.userId!);
      res.json(invites.map(inv => ({
        memberId: inv.id,
        groupId: inv.group.id,
        groupName: inv.group.name,
        inviterName: inv.inviter.displayName,
      })));
    } catch {
      res.json([]);
    }
  });

  app.post("/api/groups", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ message: "Group name is required" });
      const group = await storage.createGroup(name.trim().slice(0, 50), req.session.userId!);
      res.json(group);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create group" });
    }
  });

  app.get("/api/groups", requireAuth, async (req: Request, res: Response) => {
    try {
      const groupsData = await storage.getGroupsForUser(req.session.userId!);
      res.json(groupsData.map(g => ({
        id: g.id,
        name: g.name,
        createdBy: g.createdBy,
        createdAt: g.createdAt,
        isAdmin: g.createdBy === req.session.userId,
        members: g.members.filter(m => m.status === "accepted" || m.status === "pending").map(m => ({
          id: m.id,
          userId: m.userId,
          displayName: m.user.displayName,
          role: m.role,
          status: m.status,
        })),
      })));
    } catch {
      res.status(500).json({ message: "Failed to load groups" });
    }
  });

  app.put("/api/groups/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const group = await storage.getGroupById(req.params.id);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.createdBy !== req.session.userId) return res.status(403).json({ message: "Only admin can rename" });
      const newName = req.body.name?.trim();
      if (!newName) return res.status(400).json({ message: "Group name is required" });
      const updated = await storage.updateGroupName(req.params.id, newName.slice(0, 50));
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update group" });
    }
  });

  app.delete("/api/groups/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const group = await storage.getGroupById(req.params.id);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.createdBy !== req.session.userId) return res.status(403).json({ message: "Only admin can delete" });
      await storage.deleteGroup(req.params.id);
      res.json({ message: "Group deleted" });
    } catch {
      res.status(500).json({ message: "Failed to delete group" });
    }
  });

  app.post("/api/groups/:id/invite", requireAuth, async (req: Request, res: Response) => {
    try {
      const group = await storage.getGroupById(req.params.id);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.createdBy !== req.session.userId) return res.status(403).json({ message: "Only admin can invite" });

      const { username } = req.body;
      if (!username?.trim()) return res.status(400).json({ message: "Username is required" });
      const target = await storage.getUserByUsername(username.trim());
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.id === req.session.userId) return res.status(400).json({ message: "Cannot invite yourself" });

      const members = await storage.getGroupMembers(req.params.id);
      const existing = members.find(m => m.userId === target.id);
      if (existing && (existing.status === "accepted" || existing.status === "pending")) {
        return res.status(409).json({ message: "User already in group or invited" });
      }
      if (existing) await storage.removeGroupMember(existing.id);

      const member = await storage.addGroupMember(req.params.id, target.id, req.session.userId!);
      const me = await storage.getUserById(req.session.userId!);
      sendPushToUser(target.id, "Group Invitation", `${me?.displayName || "Someone"} invited you to "${group.name}"`, { type: "group_invite", groupId: group.id });
      res.json(member);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to invite member" });
    }
  });

  app.post("/api/groups/invites/respond", requireAuth, async (req: Request, res: Response) => {
    try {
      const { memberId, accept } = req.body;
      const member = await storage.getGroupMemberById(memberId);
      if (!member) return res.status(404).json({ message: "Invitation not found" });
      if (member.userId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateGroupMemberStatus(memberId, accept ? "accepted" : "rejected");
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to respond to invitation" });
    }
  });

  app.delete("/api/groups/:groupId/members/:memberId", requireAuth, async (req: Request, res: Response) => {
    try {
      const group = await storage.getGroupById(req.params.groupId);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.createdBy !== req.session.userId) return res.status(403).json({ message: "Only admin can remove members" });
      const member = await storage.getGroupMemberById(req.params.memberId);
      if (!member) return res.status(404).json({ message: "Member not found" });
      if (member.userId === req.session.userId) return res.status(400).json({ message: "Cannot remove yourself" });
      await storage.removeGroupMember(req.params.memberId);
      res.json({ message: "Member removed" });
    } catch {
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  app.get("/api/groups/:id/dashboard", requireAuth, async (req: Request, res: Response) => {
    try {
      const members = await storage.getGroupMembers(req.params.id);
      const isMember = members.some(m => m.userId === req.session.userId && m.status === "accepted");
      if (!isMember) return res.status(403).json({ message: "Not a member of this group" });

      const group = await storage.getGroupById(req.params.id);
      const date = new Date().toISOString().split("T")[0];
      const accepted = members.filter(m => m.status === "accepted");

      const memberData = await Promise.all(accepted.map(async (m) => {
        const [summary, streak] = await Promise.all([
          storage.getUserSummary(m.userId, date),
          storage.getUserStreak(m.userId),
        ]);
        return {
          userId: m.userId,
          displayName: m.user.displayName,
          role: m.role,
          summary: {
            completed: summary.completed,
            pending: summary.pending,
            missed: summary.missed,
            total: summary.total,
            streak,
          },
        };
      }));

      res.json({ group, members: memberData });
    } catch {
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  app.post("/api/groups/:id/nudge", requireAuth, async (req: Request, res: Response) => {
    try {
      const members = await storage.getGroupMembers(req.params.id);
      const isMember = members.some(m => m.userId === req.session.userId && m.status === "accepted");
      if (!isMember) return res.status(403).json({ message: "Not a member of this group" });

      const group = await storage.getGroupById(req.params.id);
      const date = new Date().toISOString().split("T")[0];
      const me = await storage.getUserById(req.session.userId!);
      const { message } = req.body;
      let sent = 0;

      for (const m of members.filter(m => m.status === "accepted" && m.userId !== req.session.userId)) {
        const summary = await storage.getUserSummary(m.userId, date);
        if (summary.completed < summary.total) {
          const nudgeMsg = message || "Time for your meds! 💊";
          await storage.createNudge(req.session.userId!, m.userId, "reminder", null, nudgeMsg);
          sendPushToUser(m.userId, `${group?.name || "Group"}`, `${me?.displayName || "Someone"}: ${nudgeMsg}`, { type: "group_nudge" });
          sent++;
        }
      }
      res.json({ sent });
    } catch {
      res.status(500).json({ message: "Failed to send group nudge" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
