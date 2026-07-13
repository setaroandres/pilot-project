import "server-only";
import {
  createAuditReader,
  createPrismaAuditSink,
  setAuditSink,
} from "@upstart13-com/aiden-security";
import { prisma } from "@/lib/prisma";

setAuditSink(
  createPrismaAuditSink({
    prisma,
    captureRequestMeta: () => ({}),
  })
);

export const auditReader = createAuditReader({ prisma });
