import React from 'react';
import { Router, Server, Shield, Box, X } from 'lucide-react';

interface DevicePaletteProps {
  onClose?: () => void;
}

export const DevicePalette: React.FC<DevicePaletteProps> = ({ onClose }) => {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const devices = [
    { type: 'router', label: 'Router', icon: Router },
    { type: 'switch', label: 'Switch', icon: Server },
    { type: 'firewall', label: 'Firewall', icon: Shield },
    { type: 'endpoint', label: 'Endpoint', icon: Box },
  ];

  return (
    <div className="absolute top-4 left-4 bg-white p-2 rounded-lg shadow-md z-10 flex flex-col gap-2 border border-gray-200 min-w-[120px]">
      <div className="flex justify-between items-center px-1 mb-1">
        <h3 className="text-xs font-semibold text-gray-500">Devices</h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>
      {devices.map((device) => (
        <div
          key={device.type}
          className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded cursor-move border border-transparent hover:border-gray-300 transition-colors"
          onDragStart={(event) => onDragStart(event, device.type, device.label)}
          draggable
        >
          <device.icon size={18} className="text-gray-700" />
          <span className="text-sm text-gray-700">{device.label}</span>
        </div>
      ))}
    </div>
  );
};
