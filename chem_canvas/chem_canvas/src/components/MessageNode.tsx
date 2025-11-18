import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface MessageNodeData {
  label: string;
}

const MessageNode: React.FC<NodeProps<MessageNodeData>> = ({ data }) => {
  return (
    <div className="message-node bg-green-100 border border-green-300 rounded-lg p-3 text-green-800 shadow-sm max-w-xs">
      <div className="text-sm">{data.label}</div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default MessageNode;