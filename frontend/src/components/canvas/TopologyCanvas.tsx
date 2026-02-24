import React, { useCallback, useEffect, useState, useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProjectStore } from '../../store/projectStore';
import { DevicePalette } from './DevicePalette';

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

// Wrapper component to provide ReactFlow context
const CanvasContent: React.FC = () => {
  const { currentProject, devices, links, addLink, addDevice, selectDevice } = useProjectStore();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync state with store
  useEffect(() => {
    if (!devices) return;
    
    const flowNodes: Node[] = devices.map(d => ({
      id: d.id,
      position: { x: d.canvas_x, y: d.canvas_y },
      data: { label: d.hostname, role: d.role },
      type: 'default', // We can create custom node types later
      style: { 
        border: '1px solid #777', 
        padding: 10, 
        borderRadius: 5,
        background: d.role === 'router' ? '#eef' : d.role === 'switch' ? '#eef' : '#fff',
        minWidth: 100,
        textAlign: 'center'
      }
    }));
    setNodes(flowNodes);
  }, [devices, setNodes]);

  useEffect(() => {
    if (!links) return;

    const flowEdges: Edge[] = links.map(l => ({
      id: l.id,
      source: l.source_device_id,
      target: l.target_device_id,
      label: `${l.source_interface} <-> ${l.target_interface}`,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 }
    }));
    setEdges(flowEdges);
  }, [links, setEdges]);

  const onConnect = useCallback((params: Connection | Edge) => {
    if (!params.source || !params.target) return;
    
    // In a real app, open modal to select interfaces
    const newLink = {
      source_device_id: params.source,
      source_interface: 'Eth0/0', 
      target_device_id: params.target,
      target_interface: 'Eth0/0',
      medium: 'ethernet'
    };
    
    addLink(newLink);
  }, [addLink]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow/type');
      const label = event.dataTransfer.getData('application/reactflow/label');

      // check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newDevice = {
        hostname: `${label}-${Math.floor(Math.random() * 1000)}`,
        role: type,
        vendor: 'cisco', // Default
        platform: 'ios-xe', // Default
        canvas_x: position.x,
        canvas_y: position.y,
      };

      addDevice(newDevice);
    },
    [screenToFlowPosition, addDevice],
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    selectDevice(node.id);
  }, [selectDevice]);

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400">
        Select or create a project to get started
      </div>
    );
  }

  return (
    <div className="flex-1 h-full w-full bg-white relative" ref={reactFlowWrapper}>
      <DevicePalette />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

export const TopologyCanvas: React.FC = () => {
  return (
    <ReactFlowProvider>
      <CanvasContent />
    </ReactFlowProvider>
  );
};
