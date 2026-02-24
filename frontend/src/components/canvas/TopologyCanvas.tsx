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
import { Plus } from 'lucide-react';
import { ConnectionModal } from '../modals/ConnectionModal';
import { DeviceNode } from './DeviceNode';
import { AnimatedEdge } from './AnimatedEdge';

const nodeTypes = {
  device: DeviceNode,
};

const edgeTypes = {
  animated: AnimatedEdge,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

// Wrapper component to provide ReactFlow context
const CanvasContent: React.FC = () => {
  const { currentProject, devices, links, addLink, addDevice, selectDevice } = useProjectStore();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showPalette, setShowPalette] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);

  // Sync state with store
  useEffect(() => {
    if (!devices) return;
    
    const flowNodes: Node[] = devices.map(d => ({
      id: d.id,
      position: { x: d.canvas_x, y: d.canvas_y },
      data: {
        hostname: d.hostname,
        role: d.role,
        management_ip: d.management_ip,
        vendor: d.vendor,
        platform: d.platform,
        vlans: d.vlans,
        interfaces: d.interfaces
      },
      type: 'device',
    }));
    setNodes(flowNodes);
  }, [devices, setNodes]);

  useEffect(() => {
    if (!links) return;

    const flowEdges: Edge[] = links.map(l => ({
      id: l.id,
      source: l.source_device_id,
      target: l.target_device_id,
      data: {
        label: `${l.source_interface} <-> ${l.target_interface}`,
        medium: l.medium,
        state: l.state
      },
      type: 'animated',
    }));
    setEdges(flowEdges);
  }, [links, setEdges]);

  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    setPendingConnection(params);
  }, []);

  const handleConnectionConfirm = (data: { source_interface: string, target_interface: string, medium: string }) => {
    if (!pendingConnection) return;
    
    const newLink = {
      source_device_id: pendingConnection.source,
      source_interface: data.source_interface,
      target_device_id: pendingConnection.target,
      target_interface: data.target_interface,
      medium: data.medium
    };
    
    addLink(newLink);
    setPendingConnection(null);
  };

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
      setShowPalette(false);
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

  const sourceDevice = devices.find(d => d.id === pendingConnection?.source);
  const targetDevice = devices.find(d => d.id === pendingConnection?.target);

  return (
    <div className="flex-1 h-full w-full bg-white relative" ref={reactFlowWrapper}>
      {pendingConnection && sourceDevice && targetDevice && (
        <ConnectionModal
          sourceDevice={sourceDevice}
          targetDevice={targetDevice}
          onConfirm={handleConnectionConfirm}
          onCancel={() => setPendingConnection(null)}
        />
      )}
      {showPalette ? (
        <DevicePalette onClose={() => setShowPalette(false)} />
      ) : (
        <button
          onClick={() => setShowPalette(true)}
          className="absolute top-4 left-4 z-10 bg-indigo-600 text-white p-2 rounded-lg shadow-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 px-3 h-10"
        >
          <Plus size={20} />
          <span className="text-sm font-medium">Add Device</span>
        </button>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
