import React, { useState } from 'react';
import { X, Cable } from 'lucide-react';
import type { Device } from '../../api/devices';

interface ConnectionModalProps {
  sourceDevice: Device;
  targetDevice: Device;
  onConfirm: (data: {
    source_interface: string;
    target_interface: string;
    medium: string;
  }) => void;
  onCancel: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  sourceDevice,
  targetDevice,
  onConfirm,
  onCancel,
}) => {
  const [sourceIntf, setSourceIntf] = useState(sourceDevice.interfaces[0]?.name || '');
  const [targetIntf, setTargetIntf] = useState(targetDevice.interfaces[0]?.name || '');
  const [medium, setMedium] = useState('ethernet');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-[450px] overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <Cable size={18} className="text-indigo-600" />
            <h2 className="font-semibold text-gray-800">New Connection</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {sourceDevice.hostname} (Source)
              </label>
              <select
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={sourceIntf}
                onChange={(e) => setSourceIntf(e.target.value)}
              >
                {sourceDevice.interfaces.length > 0 ? (
                  sourceDevice.interfaces.map(i => (
                    <option key={i.id} value={i.name}>{i.name}</option>
                  ))
                ) : (
                  <option value="Eth0/0">Eth0/0 (Default)</option>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {targetDevice.hostname} (Target)
              </label>
              <select
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={targetIntf}
                onChange={(e) => setTargetIntf(e.target.value)}
              >
                {targetDevice.interfaces.length > 0 ? (
                  targetDevice.interfaces.map(i => (
                    <option key={i.id} value={i.name}>{i.name}</option>
                  ))
                ) : (
                  <option value="Eth0/0">Eth0/0 (Default)</option>
                )}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Media Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="medium"
                  value="ethernet"
                  checked={medium === 'ethernet'}
                  onChange={() => setMedium('ethernet')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                Ethernet (Blue)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="medium"
                  value="fiber"
                  checked={medium === 'fiber'}
                  onChange={() => setMedium('fiber')}
                  className="text-orange-600 focus:ring-orange-500"
                />
                Fiber (Orange)
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ source_interface: sourceIntf || 'Eth0/0', target_interface: targetIntf || 'Eth0/0', medium })}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
};
