"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  type Node,
  type NodeProps,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export type PipelineState = "done" | "active" | "paused" | "failed" | "pending" | "skipped";

export interface PipelineNode {
  id: number;
  label: string;
  state: PipelineState;
}

interface OaaNodeData extends Record<string, unknown> {
  label: string;
  state: PipelineState;
  selected: boolean;
}

/** Simplified, evenly spaced 10-node pipeline (user-approved over the 13-node lock). */
export const DAG_LAYOUT: Record<number, { x: number; y: number }> = {
  1: { x: 200, y: 0 },
  2: { x: 0, y: 110 },
  3: { x: 400, y: 110 },
  4: { x: 200, y: 220 },
  5: { x: 200, y: 330 },
  6: { x: 200, y: 440 },
  7: { x: 200, y: 550 },
  8: { x: 400, y: 660 },
  9: { x: 200, y: 770 },
  10: { x: 200, y: 880 },
};

export const DAG_EDGES: { id: string; source: number; target: number; label?: string; dashed?: boolean }[] = [
  { id: "e1-2", source: 1, target: 2 },
  { id: "e1-3", source: 1, target: 3 },
  { id: "e2-4", source: 2, target: 4 },
  { id: "e3-4", source: 3, target: 4 },
  { id: "e4-5", source: 4, target: 5 },
  { id: "e5-6", source: 5, target: 6 },
  { id: "e6-7", source: 6, target: 7 },
  { id: "e7-8", source: 7, target: 8, label: "is_code_bug", dashed: true },
  { id: "e8-9", source: 8, target: 9 },
  { id: "e7-9", source: 7, target: 9, label: "infra only" },
  { id: "e9-10", source: 9, target: 10 },
];

const stateStyle: Record<PipelineState, string> = {
  done: "border-oaa-green/60 bg-oaa-green/10 text-oaa-green",
  active: "border-oaa-cyan/70 bg-oaa-cyan/10 text-oaa-cyan",
  paused: "border-oaa-amber/70 bg-oaa-amber/10 text-oaa-amber",
  failed: "border-oaa-red bg-oaa-red/10 text-oaa-red font-bold",
  pending: "border-oaa-line bg-oaa-raised text-oaa-muted opacity-55",
  skipped: "border-dashed border-oaa-line bg-oaa-raised text-oaa-muted opacity-40",
};

const hide = "!opacity-0 !pointer-events-none";

function OaaNode({ data }: NodeProps<Node<OaaNodeData>>) {
  return (
    <div
      className={`w-[190px] rounded border px-3 py-2 text-center font-mono text-[11px] transition-all duration-300 ${stateStyle[data.state]} ${
        data.selected ? "ring-2 ring-oaa-cyan" : ""
      }`}
    >
      <Handle id="t" type="target" position={Position.Top} className={hide} />
      <Handle id="l" type="target" position={Position.Left} className={hide} />
      <Handle id="rt" type="target" position={Position.Right} className={hide} />
      <Handle id="b" type="source" position={Position.Bottom} className={hide} />
      <Handle id="r" type="source" position={Position.Right} className={hide} />
      <Handle id="ls" type="source" position={Position.Left} className={hide} />
      {data.label}
    </div>
  );
}

// must live outside the component, otherwise React Flow re-renders in a loop
const nodeTypes = { oaa: OaaNode };

interface DagCanvasProps {
  nodes: PipelineNode[];
  selectedNodeId: number | null;
  onSelectNode: (id: number) => void;
}

function handlesFor(source: number, target: number) {
  const s = DAG_LAYOUT[source];
  const t = DAG_LAYOUT[target];
  if (!s || !t) return { sourceHandle: "b", targetHandle: "t" };
  if (t.y === s.y) return { sourceHandle: t.x > s.x ? "r" : "ls", targetHandle: t.x > s.x ? "l" : "rt" };
  if (t.x === s.x) return { sourceHandle: "b", targetHandle: "t" };
  // diagonal: leave bottom, enter from the nearest side
  return { sourceHandle: "b", targetHandle: t.x > s.x ? "l" : "rt" };
}

export default function DagCanvas({ nodes, selectedNodeId, onSelectNode }: DagCanvasProps) {
  const flowNodes: Node<OaaNodeData>[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: String(n.id),
        type: "oaa",
        position: DAG_LAYOUT[n.id] ?? { x: 0, y: 0 },
        data: { label: n.label, state: n.state, selected: n.id === selectedNodeId },
      })),
    [nodes, selectedNodeId],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      DAG_EDGES.map((e) => {
        const { sourceHandle, targetHandle } = handlesFor(e.source, e.target);
        const lit = nodes.find((n) => n.id === e.target)?.state !== "pending";
        return {
          id: e.id,
          source: String(e.source),
          target: String(e.target),
          sourceHandle,
          targetHandle,
          label: e.label,
          type: "smoothstep",
          labelStyle: { fill: "#8b8b8b", fontSize: 9, fontFamily: "var(--font-mono)" },
          style: {
            stroke: lit ? "#7c8aa5" : "#3a3a3a",
            strokeWidth: 1.5,
            strokeDasharray: e.dashed ? "5 4" : undefined,
            opacity: lit ? 1 : 0.35,
            transition: "opacity 300ms",
          },
        };
      }),
    [nodes],
  );

  return (
    <div className="h-[680px] w-full overflow-hidden rounded-lg border border-oaa-line bg-oaa-panel">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        onNodeClick={(_, node) => onSelectNode(Number(node.id))}
      >
        <Background color="#2a2a2a" gap={20} />
      </ReactFlow>
    </div>
  );
}
