import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Router, Server, Shield, Box, Network, Cpu, Tag, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export const DeviceNode = memo(({ data, selected }: NodeProps) => {
  const {
    hostname,
    role,
    management_ip,
    vendor = 'cisco',
    platform = 'ios-xe',
    vlans = [],
    interfaces = []
  } = data as any;

  const Icon = role === 'router' ? Router :
               role === 'switch' ? Server :
               role === 'firewall' ? Shield : Box;

  // Determine state based on if we have parsed interfaces
  const hasConfig = interfaces.length > 0;
  const state = hasConfig ? 'connected' : 'pending';

  const stateColors: any = {
    connected: 'border-green-500 shadow-green-500/20',
    misconfigured: 'border-red-500 shadow-red-500/20',
    pending: 'border-yellow-500 shadow-yellow-500/20',
  };

  const StateIcon = () => {
    if (state === 'connected') return <CheckCircle size={12} className="text-green-500" />;
    if (state === 'misconfigured') return <AlertCircle size={12} className="text-red-500" />;
    return <Clock size={12} className="text-yellow-500" />;
  };

  const connectedPorts = interfaces.filter((i: any) => i.state === 'up').map((i: any) => i.name);

  return (
    <div className={`
      relative px-4 py-3 bg-white border-2 rounded-xl shadow-lg transition-all duration-200 min-w-[200px]
      ${stateColors[state]}
      ${selected ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}
    `}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-400" />
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-gray-400" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-gray-400" />

      <div className="flex items-center gap-3 mb-2 border-b border-gray-100 pb-2">
        <div className={`p-2 rounded-lg ${role === 'router' ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{role}</span>
            <StateIcon />
          </div>
          <div className="text-sm font-bold text-gray-800 truncate">{hostname}</div>
        </div>
      </div>

      <div className="space-y-1.5 text-[10px]">
        <div className="flex items-center justify-between text-gray-600">
          <div className="flex items-center gap-1.5">
            <Network size={12} className="text-gray-400" />
            <span className="font-mono">{management_ip || 'No IP'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-gray-600">
          <Cpu size={12} className="text-gray-400" />
          <span>{vendor.toUpperCase()} {platform}</span>
        </div>

        {vlans.length > 0 && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Tag size={12} className="text-gray-400" />
            <div className="flex flex-wrap gap-1">
              {vlans.slice(0, 3).map((v: any) => (
                <span key={v.vlan_id} className="bg-gray-100 px-1 rounded text-gray-500 font-medium">V{v.vlan_id}</span>
              ))}
              {vlans.length > 3 && <span className="text-gray-400">+{vlans.length - 3}</span>}
            </div>
          </div>
        )}

        {connectedPorts.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-50">
            <div className="text-[9px] font-bold text-gray-400 mb-1 uppercase tracking-tighter">UP PORTS</div>
            <div className="flex flex-wrap gap-1">
              {connectedPorts.slice(0, 4).map((p: any) => (
                <span key={p} className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-sm font-medium border border-indigo-100">{p}</span>
              ))}
              {connectedPorts.length > 4 && <span className="text-gray-400">+{connectedPorts.length - 4}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

DeviceNode.displayName = 'DeviceNode';
