import React, { useState } from 'react';

export default function MultiCameraManager({ cameras = [], onSelectCamera }) {
  const [selectedCamera, setSelectedCamera] = useState(cameras[0] || null);
  const [viewMode, setViewMode] = useState('single'); // 'single', 'grid-4', 'grid-9'

  const handleSelectCamera = (camera) => {
    setSelectedCamera(camera);
    onSelectCamera?.(camera);
  };

  // Default mock cameras if none provided
  const mockCameras = cameras.length === 0
    ? [
        { id: 1, name: 'Main Street - Zone A', location: 'Downtown', status: 'active', zone: 'A' },
        { id: 2, name: 'Highway Exit - Zone B', location: 'North', status: 'active', zone: 'B' },
        { id: 3, name: 'Market Square - Zone C', location: 'Center', status: 'inactive', zone: 'C' },
        { id: 4, name: 'Airport Road - Zone D', location: 'East', status: 'active', zone: 'D' },
        { id: 5, name: 'Railway Station - Zone E', location: 'South', status: 'active', zone: 'E' },
        { id: 6, name: 'Industrial Area - Zone F', location: 'West', status: 'inactive', zone: 'F' },
      ]
    : cameras;

  const activeCameras = mockCameras.filter((c) => c.status === 'active');
  const inactiveCameras = mockCameras.filter((c) => c.status === 'inactive');

  return (
    <div className="bg-gray-900 text-white rounded-lg overflow-hidden border border-gray-700">
      {/* Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">📹 Multi-Camera Manager</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('single')}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                viewMode === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              1x1
            </button>
            <button
              onClick={() => setViewMode('grid-4')}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                viewMode === 'grid-4'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              2x2
            </button>
            <button
              onClick={() => setViewMode('grid-9')}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                viewMode === 'grid-9'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              3x3
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-gray-400">Active:</span>
            <span className="text-green-400 font-bold ml-2">{activeCameras.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Inactive:</span>
            <span className="text-red-400 font-bold ml-2">{inactiveCameras.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Total:</span>
            <span className="text-blue-400 font-bold ml-2">{mockCameras.length}</span>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Camera List Sidebar */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 overflow-y-auto max-h-96">
          {/* Active Cameras */}
          <div className="p-4 border-b border-gray-700">
            <p className="text-xs font-semibold text-green-400 mb-2">🟢 ACTIVE CAMERAS</p>
            <div className="space-y-2">
              {activeCameras.map((camera) => (
                <div
                  key={camera.id}
                  onClick={() => handleSelectCamera(camera)}
                  className={`p-2 rounded cursor-pointer transition ${
                    selectedCamera?.id === camera.id
                      ? 'bg-blue-600 border border-blue-400'
                      : 'bg-gray-700 hover:bg-gray-600 border border-transparent'
                  }`}
                >
                  <p className="text-sm font-semibold">{camera.name}</p>
                  <p className="text-xs text-gray-400">Zone {camera.zone}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Inactive Cameras */}
          {inactiveCameras.length > 0 && (
            <div className="p-4">
              <p className="text-xs font-semibold text-red-400 mb-2">🔴 INACTIVE CAMERAS</p>
              <div className="space-y-2 opacity-50">
                {inactiveCameras.map((camera) => (
                  <div
                    key={camera.id}
                    className="p-2 rounded bg-gray-700 border border-transparent cursor-not-allowed"
                  >
                    <p className="text-sm font-semibold">{camera.name}</p>
                    <p className="text-xs text-gray-500">Zone {camera.zone} - Offline</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feed Display Area */}
        <div className="flex-1 p-4">
          {viewMode === 'single' && selectedCamera && (
            <div className="bg-black rounded-lg overflow-hidden aspect-video border-2 border-gray-700">
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-black">
                <p className="text-4xl mb-4">📹</p>
                <p className="text-gray-400">{selectedCamera.name}</p>
                <p className="text-xs text-gray-600 mt-1">[Live Feed]</p>
              </div>
            </div>
          )}

          {viewMode === 'grid-4' && (
            <div className="grid grid-cols-2 gap-3">
              {activeCameras.slice(0, 4).map((camera) => (
                <div
                  key={camera.id}
                  onClick={() => handleSelectCamera(camera)}
                  className={`bg-black rounded-lg overflow-hidden aspect-square border-2 transition cursor-pointer ${
                    selectedCamera?.id === camera.id ? 'border-blue-500' : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-black">
                    <p className="text-2xl mb-2">📹</p>
                    <p className="text-xs text-gray-400 text-center px-2">{camera.zone}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'grid-9' && (
            <div className="grid grid-cols-3 gap-2">
              {activeCameras.map((camera) => (
                <div
                  key={camera.id}
                  onClick={() => handleSelectCamera(camera)}
                  className={`bg-black rounded-lg overflow-hidden aspect-square border-2 transition cursor-pointer ${
                    selectedCamera?.id === camera.id ? 'border-blue-500' : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-black">
                    <p className="text-lg mb-1">📹</p>
                    <p className="text-xs text-gray-400">Z{camera.zone}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
