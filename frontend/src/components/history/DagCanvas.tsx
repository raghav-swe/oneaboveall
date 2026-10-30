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
import { dagNodes, dagEdges, replaySteps } from "@/lib/mockData";
import type { DagState } from "@/lib/types";

interface DagCanvasProps {
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  revealedCount: number; // how many replay steps are lit (0..replaySteps.length)
}

interface OaaNodeData extends Record<string, unknown> {
  label: string;
  state: DagState;
  shape?: "box" | "diamond";
  selected: boolean;
  revealed: boolean;
}

const stateStyle: Record<DagState, string> = {
  done: "border-oaa-green/50 bg-oaa-green/10 text-oaa-green",
  failed: "border-oaa-red bg-oaa-red/10 text-oaa-red font-bold",
  skipped: "border-dashed border-oaa-line bg-oaa-raised text-oaa-muted opacity-70",
  active: "border-oaa-cyan/60 bg-oaa-cyan/10 text-oaa-cyan",
  pending: "border-oaa-line bg-oaa-raised text-oaa-muted",
};

const hide = "!opacity-0 !pointer-events-none";

function OaaNode({ data }: NodeProps<Node<OaaNodeData>>) {
  const style =
    data.shape === "diamond" && data.revealed
      ? "border-oaa-amber/50 bg-oaa-amber/10 text-oaa-amber"
      : stateStyle[data.state];

  return (
    <div
      className={`w-[280px] rounded border px-3 py-2 text-center font-mono text-[11px] transition-all duration-300 ${style} ${
        data.selected ? "ring-2 ring-oaa-cyan" : ""
      }`}
    >
      <Handle id="t" type="target" position={Position.Top} className={hide} />
      <Handle id="l" type="target" position={Position.Left} className={hide} />
      <Handle id="rt" type="target" position={Position.Right} className={hide} />
      <Handle id="b" type="source" position={Position.Bottom} className={hide} />
      <Handle id="r" type="source" position={Position.Right} className={hide} />
      <Handle id="ls" type="source" position={Position.Left} className={hide} />
      {data.shape === "diamond" ? `◆ ${data.label}` : data.label}
    </div>
  );
}

// must live outside the component, otherwise React Flow re-renders in a loop
const nodeTypes = { oaa: OaaNode };

// which replay step lights each node
const stepOf = new Map<string, number>();
replaySteps.forEach((ids, i) => ids.forEach((id) => stepOf.set(id, i)));
const isRevealed = (id: string, count: number) => (stepOf.get(id) ?? 0) < count;

export default function DagCanvas({ selectedNodeId, onSelectNode, revealedCount }: DagCanvasProps) {
  const nodes: Node<OaaNodeData>[] = useMemo(
    () =>
      dagNodes.map((n) => {
        const revealed = isRevealed(n.id, revealedCount);
        return {
          id: n.id,
          type: "oaa",
          position: { x: n.x, y: n.y },
          data: {
            label: n.label,
            state: revealed ? n.state : "pending",
            shape: n.shape,
            selected: n.id === selectedNodeId,
            revealed,
          },
        };
      }),
    [selectedNodeId, revealedCount]
  );

  const edges: Edge[] = useMemo(
    () =>
      dagEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? "b",
        targetHandle: e.targetHandle ?? "t",
        type: "smoothstep",
        style: {
          stroke: "#7c8aa5",
          strokeWidth: 1.5,
          opacity: isRevealed(e.target, revealedCount) ? 1 : 0.2,
          transition: "opacity 300ms",
        },
      })),
    [revealedCount]
  );

  return (
    <div className="h-[700px] w-full overflow-hidden rounded-lg border border-oaa-line bg-oaa-panel">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        onNodeClick={(_, node) => onSelectNode(node.id)}
      >
        <Background color="#1f2a44" gap={20} />
      </ReactFlow>
    </div>
  );
}