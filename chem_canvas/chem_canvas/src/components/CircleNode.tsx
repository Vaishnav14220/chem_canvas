import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface CircleNodeData {
  label: string;
}

const CircleNode: React.FC<NodeProps<CircleNodeData>> = ({ data }) => {
  return (
    <div className="circle-node w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold shadow-lg">
      {data.label}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default CircleNode;