import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { db } from '@/lib/db/storage';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { InvoiceDocument, type InvoiceLineItem } from '@/lib/pdf/invoice-document';

/** Generates a PDF invoice for a project from its logged worklog hours,
 *  billed at the project's hourly_rate. Accepts an optional date range to
 *  invoice a specific period (e.g. "this month") rather than every hour
 *  ever logged — repeat invoicing without a range would double-bill
 *  already-invoiced hours, so the client always passes a range in
 *  practice; it's optional here only to keep the route flexible for a
 *  future "invoice everything outstanding" mode. */
export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { projectId, workspaceId, periodStart, periodEnd, clientName } = body as {
    projectId?: string;
    workspaceId?: string;
    periodStart?: string;
    periodEnd?: string;
    clientName?: string;
  };
  if (!projectId || !workspaceId) {
    return NextResponse.json({ error: 'projectId and workspaceId are required' }, { status: 400 });
  }

  const member = await db.getWorkspaceUser(workspaceId, authUser.id);
  if (!member) {
    return NextResponse.json({ error: 'Tenant boundary violation: not a member of this workspace.' }, { status: 403 });
  }

  const project = await db.getProjectById(projectId, workspaceId);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!project.hourlyRate || project.hourlyRate <= 0) {
    return NextResponse.json({ error: 'Project has no hourly rate set' }, { status: 400 });
  }

  const workspace = await db.getWorkspaceById(workspaceId);
  const tasks = await db.getTasks(workspaceId, projectId);

  const rangeStart = periodStart ? new Date(periodStart) : null;
  const rangeEnd = periodEnd ? new Date(periodEnd) : null;

  const lineItems: InvoiceLineItem[] = [];
  for (const task of tasks) {
    for (const log of task.worklogs || []) {
      const loggedDate = new Date(log.loggedAt);
      if (rangeStart && loggedDate < rangeStart) continue;
      if (rangeEnd && loggedDate > rangeEnd) continue;
      lineItems.push({
        taskTitle: task.title,
        hours: log.hours,
        description: log.description,
        loggedAt: log.loggedAt,
      });
    }
  }

  if (lineItems.length === 0) {
    return NextResponse.json({ error: 'No logged hours found for the selected period' }, { status: 400 });
  }

  // Oldest first reads more naturally on an invoice than the worklog feed's
  // usual newest-first ordering.
  lineItems.sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());

  const invoiceNumber = `${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  try {
    const pdfBuffer = await renderToBuffer(
      InvoiceDocument({
        data: {
          workspaceName: workspace?.name || 'Syncora',
          projectName: project.name,
          clientName,
          invoiceNumber,
          issueDate: new Date().toISOString(),
          hourlyRate: project.hourlyRate,
          lineItems,
          periodStart,
          periodEnd,
        },
      })
    );

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[invoice] PDF generation failed', err);
    return NextResponse.json({ error: 'Failed to generate invoice PDF' }, { status: 500 });
  }
}
