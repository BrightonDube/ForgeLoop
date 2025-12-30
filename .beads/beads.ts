/**
 * Beads Issue Tracker - CLI Helper
 * 
 * Usage:
 *   npx tsx .beads/beads.ts list [--status=TODO] [--phase=1] [--priority=CRITICAL]
 *   npx tsx .beads/beads.ts get FL-001
 *   npx tsx .beads/beads.ts update FL-001 --status=IN_PROGRESS
 *   npx tsx .beads/beads.ts next
 */

import * as fs from 'fs';
import * as path from 'path';

interface Issue {
  id: string;
  title: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED';
  labels: string[];
  phase: number;
  estimatedHours: number;
  dependencies: string[];
  acceptanceCriteria: string[];
  createdAt: string;
  completedAt?: string;
}

const ISSUES_PATH = path.join(__dirname, 'issues.jsonl');

function loadIssues(): Issue[] {
  const content = fs.readFileSync(ISSUES_PATH, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function saveIssues(issues: Issue[]): void {
  const content = issues.map(i => JSON.stringify(i)).join('\n');
  fs.writeFileSync(ISSUES_PATH, content);
}

function priorityWeight(p: string): number {
  const weights: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  return weights[p] || 0;
}

function listIssues(filters: { status?: string; phase?: number; priority?: string }): void {
  let issues = loadIssues();
  
  if (filters.status) {
    issues = issues.filter(i => i.status === filters.status);
  }
  if (filters.phase) {
    issues = issues.filter(i => i.phase === filters.phase);
  }
  if (filters.priority) {
    issues = issues.filter(i => i.priority === filters.priority);
  }
  
  issues.sort((a, b) => {
    if (a.phase !== b.phase) return a.phase - b.phase;
    return priorityWeight(b.priority) - priorityWeight(a.priority);
  });
  
  console.log('\n=== FORGELOOP ISSUES ===\n');
  console.log(`Total: ${issues.length}\n`);
  
  for (const issue of issues) {
    const status = issue.status.padEnd(12);
    const priority = issue.priority.padEnd(8);
    console.log(`[${issue.id}] [P${issue.phase}] [${priority}] [${status}] ${issue.title}`);
  }
}

function getIssue(id: string): void {
  const issues = loadIssues();
  const issue = issues.find(i => i.id === id);
  
  if (!issue) {
    console.error(`Issue ${id} not found`);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`ID: ${issue.id}`);
  console.log(`Title: ${issue.title}`);
  console.log(`Status: ${issue.status}`);
  console.log(`Priority: ${issue.priority}`);
  console.log(`Phase: ${issue.phase}`);
  console.log(`Estimated Hours: ${issue.estimatedHours}`);
  console.log(`Labels: ${issue.labels.join(', ')}`);
  console.log(`Dependencies: ${issue.dependencies.length ? issue.dependencies.join(', ') : 'None'}`);
  console.log('='.repeat(60));
  console.log('\nDescription:');
  console.log(issue.description);
  console.log('\nAcceptance Criteria:');
  issue.acceptanceCriteria.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  console.log('');
}

function updateIssue(id: string, updates: Partial<Issue>): void {
  const issues = loadIssues();
  const idx = issues.findIndex(i => i.id === id);
  
  if (idx === -1) {
    console.error(`Issue ${id} not found`);
    process.exit(1);
  }
  
  issues[idx] = { ...issues[idx], ...updates };
  
  if (updates.status === 'DONE' && !issues[idx].completedAt) {
    issues[idx].completedAt = new Date().toISOString();
  }
  
  saveIssues(issues);
  console.log(`Updated ${id}: ${JSON.stringify(updates)}`);
}

function getNextIssue(): void {
  const issues = loadIssues();
  const doneIds = new Set(issues.filter(i => i.status === 'DONE').map(i => i.id));
  
  const candidates = issues
    .filter(i => i.status === 'TODO')
    .filter(i => i.dependencies.every(d => doneIds.has(d)))
    .sort((a, b) => {
      if (a.phase !== b.phase) return a.phase - b.phase;
      return priorityWeight(b.priority) - priorityWeight(a.priority);
    });
  
  if (candidates.length === 0) {
    console.log('\nNo available issues. All TODO issues have unmet dependencies or all work is done.');
    
    const inProgress = issues.filter(i => i.status === 'IN_PROGRESS');
    if (inProgress.length > 0) {
      console.log('\nCurrently IN_PROGRESS:');
      inProgress.forEach(i => console.log(`  [${i.id}] ${i.title}`));
    }
    return;
  }
  
  const next = candidates[0];
  console.log('\n=== NEXT ISSUE TO WORK ON ===\n');
  getIssue(next.id);
}

function showStats(): void {
  const issues = loadIssues();
  
  const byStatus: Record<string, number> = {};
  const byPhase: Record<number, number> = {};
  const byPriority: Record<string, number> = {};
  let totalHours = 0;
  let doneHours = 0;
  
  for (const issue of issues) {
    byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;
    byPhase[issue.phase] = (byPhase[issue.phase] || 0) + 1;
    byPriority[issue.priority] = (byPriority[issue.priority] || 0) + 1;
    totalHours += issue.estimatedHours;
    if (issue.status === 'DONE') doneHours += issue.estimatedHours;
  }
  
  console.log('\n=== FORGELOOP PROJECT STATS ===\n');
  console.log(`Total Issues: ${issues.length}`);
  console.log(`Total Estimated Hours: ${totalHours}`);
  console.log(`Completed Hours: ${doneHours}`);
  console.log(`Progress: ${((doneHours / totalHours) * 100).toFixed(1)}%`);
  
  console.log('\nBy Status:');
  Object.entries(byStatus).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  
  console.log('\nBy Phase:');
  Object.entries(byPhase).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([k, v]) => console.log(`  Phase ${k}: ${v}`));
  
  console.log('\nBy Priority:');
  ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach(p => {
    if (byPriority[p]) console.log(`  ${p}: ${byPriority[p]}`);
  });
}

// CLI Parser
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'list': {
    const filters: any = {};
    args.slice(1).forEach(arg => {
      const [key, val] = arg.replace('--', '').split('=');
      if (key === 'phase') filters.phase = parseInt(val);
      else filters[key] = val;
    });
    listIssues(filters);
    break;
  }
  case 'get':
    getIssue(args[1]);
    break;
  case 'update': {
    const updates: any = {};
    args.slice(2).forEach(arg => {
      const [key, val] = arg.replace('--', '').split('=');
      updates[key] = val;
    });
    updateIssue(args[1], updates);
    break;
  }
  case 'next':
    getNextIssue();
    break;
  case 'stats':
    showStats();
    break;
  default:
    console.log(`
Beads Issue Tracker

Commands:
  list [--status=X] [--phase=N] [--priority=X]  List issues with optional filters
  get <ID>                                       Get issue details
  update <ID> --status=X                         Update issue status
  next                                           Get next issue to work on
  stats                                          Show project statistics

Examples:
  npx tsx .beads/beads.ts list --status=TODO
  npx tsx .beads/beads.ts get FL-001
  npx tsx .beads/beads.ts update FL-001 --status=IN_PROGRESS
  npx tsx .beads/beads.ts next
  npx tsx .beads/beads.ts stats
`);
}
