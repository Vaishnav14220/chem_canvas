import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface TextNodeData {
  label: string;
}

const TextNode: React.FC<NodeProps<TextNodeData>> = ({ data }) => {
  return (
    <div className="text-node bg-gray-100 border border-gray-300 rounded p-2 text-sm text-gray-800 shadow-sm">
      {data.label}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

export default TextNode;