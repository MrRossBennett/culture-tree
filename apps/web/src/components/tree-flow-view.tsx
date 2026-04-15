import type { CultureTree, TreeEnrichmentsMap, TreeNode } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CultureTreeBranchNodeCard, CultureTreeSeedCard } from "~/components/tree-preview";
import {
  buildCultureTreeFlowGraph,
  layoutCultureTreeFlowPositions,
} from "~/lib/culture-tree-flow-graph";

function flowBranchDepth(nodeId: string): number {
  if (nodeId === "seed") return -1;
  return nodeId.split("-").length - 2;
}

type SeedFlowRfNode = Node<{ tree: CultureTree; onAddBranch?: () => void }, "seed">;
type BranchFlowRfNode = Node<
  {
    nodeId: string;
    enrichments: TreeEnrichmentsMap;
    node: TreeNode;
    onAddChild?: (nodeId: string, node: TreeNode) => void;
  },
  "branch"
>;

const handleClass = "!size-2 !border-border !bg-muted-foreground !border-2 !opacity-90";

function SeedFlowNode(props: NodeProps<SeedFlowRfNode>) {
  const { tree, onAddBranch } = props.data;
  return (
    <div className="relative w-[min(40rem,calc(100vw-1.25rem))]">
      <Handle className={handleClass} id="out" position={Position.Bottom} type="source" />
      <CultureTreeSeedCard tree={tree} variant="flow" onAddBranch={onAddBranch} />
    </div>
  );
}

function BranchFlowNode(props: NodeProps<BranchFlowRfNode>) {
  const { nodeId, enrichments, node, onAddChild } = props.data;
  return (
    <div className="relative w-[min(22rem,calc(100vw-1.25rem))]">
      <Handle className={handleClass} id="in" position={Position.Top} type="target" />
      <Handle className={handleClass} id="out" position={Position.Bottom} type="source" />
      <CultureTreeBranchNodeCard
        depth={flowBranchDepth(nodeId)}
        enrichments={enrichments}
        layout="flow"
        node={node}
        nodeId={nodeId}
        onAddChild={onAddChild}
      />
    </div>
  );
}

const nodeTypes = {
  seed: SeedFlowNode,
  branch: BranchFlowNode,
} satisfies NodeTypes;

/**
 * After nodes have real dimensions, fit once and notify. `fitView` returns a Promise — we await it
 * so the parent can hide the default viewport (zoom 1) until the correct framing is applied.
 */
function FlowFitWhenMeasured({
  layoutKey,
  onViewportFitted,
  treeKey,
}: {
  readonly layoutKey: Node[];
  readonly onViewportFitted: () => void;
  readonly treeKey: string;
}) {
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  useEffect(() => {
    if (!nodesInitialized) return;
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      void (async () => {
        try {
          await fitView({ padding: 0.22, duration: 0 });
        } finally {
          if (!cancelled) onViewportFitted();
        }
      })();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [fitView, layoutKey, nodesInitialized, onViewportFitted, treeKey]);

  return null;
}

function TreeFlowCanvas({
  tree,
  enrichments,
  treeKey,
  onAddBranch,
  onAddChild,
}: {
  readonly tree: CultureTree;
  readonly enrichments: TreeEnrichmentsMap;
  readonly treeKey: string;
  readonly onAddBranch?: () => void;
  readonly onAddChild?: (nodeId: string, node: TreeNode) => void;
}) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const graph = buildCultureTreeFlowGraph(tree);
    const positions = layoutCultureTreeFlowPositions(tree);

    const nodes: Node[] = graph.nodes.map((meta) => {
      const position = positions.get(meta.id) ?? { x: 0, y: 0 };
      if (meta.role === "seed") {
        return {
          id: meta.id,
          type: "seed",
          position,
          data: { tree, onAddBranch },
        };
      }
      const node = graph.branchNodesById.get(meta.id)!;
      return {
        id: meta.id,
        type: "branch",
        position,
        data: { nodeId: meta.id, enrichments, node, onAddChild },
      };
    });

    const edges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: "out",
      targetHandle: "in",
      type: "default",
      pathOptions: { curvature: 0.35 },
    }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [enrichments, onAddBranch, onAddChild, tree]);

  const [nodes, setNodes] = useState<Node[]>(() => initialNodes);
  const [edges, setEdges] = useState<Edge[]>(() => initialEdges);
  const [viewportReady, setViewportReady] = useState(false);

  const onViewportFitted = useCallback(() => {
    setViewportReady(true);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setViewportReady(false);
      setNodes(initialNodes);
      setEdges(initialEdges);
    });
    return () => cancelAnimationFrame(id);
  }, [initialEdges, initialNodes, treeKey]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  return (
    <div className="relative h-full min-h-0 w-full">
      {!viewportReady ? (
        <div
          aria-busy="true"
          aria-label="Laying out tree"
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/85 backdrop-blur-[2px]"
        >
          <Loader2Icon aria-hidden className="size-9 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      <ReactFlow
        className={cn("h-full min-h-0 w-full", !viewportReady && "invisible")}
        defaultEdgeOptions={{
          style: {
            // RF `.dark` uses #3e3e3e — nearly invisible on our canvas; use theme tokens
            stroke: "var(--muted-foreground)",
            strokeWidth: 2,
          },
        }}
        edges={edges}
        minZoom={0.15}
        nodes={nodes}
        nodesDraggable={false}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        panOnScroll
      >
        <Background gap={18} size={1} />
        <Controls position="top-right" showInteractive={false} />
        <FlowFitWhenMeasured
          layoutKey={initialNodes}
          onViewportFitted={onViewportFitted}
          treeKey={treeKey}
        />
      </ReactFlow>
    </div>
  );
}

export function TreeFlowView({
  tree,
  enrichments,
  treeKey,
  onAddBranch,
  onAddChild,
}: {
  readonly tree: CultureTree;
  readonly enrichments: TreeEnrichmentsMap;
  readonly treeKey: string;
  readonly onAddBranch?: () => void;
  readonly onAddChild?: (nodeId: string, node: TreeNode) => void;
}) {
  return (
    <div className="relative min-h-0 flex-1 bg-muted/10">
      <ReactFlowProvider>
        <div className="absolute inset-0 min-h-0">
          <TreeFlowCanvas
            key={treeKey}
            enrichments={enrichments}
            onAddBranch={onAddBranch}
            onAddChild={onAddChild}
            tree={tree}
            treeKey={treeKey}
          />
        </div>
      </ReactFlowProvider>
    </div>
  );
}
