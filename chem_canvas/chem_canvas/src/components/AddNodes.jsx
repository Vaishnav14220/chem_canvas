import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { IconSearch } from '@tabler/icons-react'

// Simple AddNodes component for Chem Canvas
const AddNodes = () => {
  const [searchValue, setSearchValue] = useState('')
  const componentNodes = useSelector((state) => state.canvas.componentNodes || [])

  // Group nodes by category
  const groupedNodes = componentNodes.reduce((acc, node) => {
    if (!acc[node.category]) {
      acc[node.category] = []
    }
    acc[node.category].push(node)
    return acc
  }, {})

  const filteredNodes = componentNodes.filter(node =>
    node.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    node.type.toLowerCase().includes(searchValue.toLowerCase())
  )

  const handleDragStart = (event, node) => {
    event.dataTransfer.setData('application/json', JSON.stringify(node))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e293b' }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #334155' }}>
        <h3 style={{ color: 'white', margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Add Nodes
        </h3>
      </div>

      {/* Search */}
      <div style={{ padding: '16px', borderBottom: '1px solid #334155' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#64748b'
            }}
          />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: 'white',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* Node List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {searchValue ? (
          // Show filtered results
          <div>
            <h4 style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>
              Search Results
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredNodes.map((node) => (
                <div
                  key={node.name}
                  draggable
                  onDragStart={(e) => handleDragStart(e, node)}
                  style={{
                    padding: '12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{node.icon}</span>
                  <div>
                    <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>
                      {node.type}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>
                      {node.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Show grouped results
          Object.entries(groupedNodes).map(([category, nodes]) => (
            <div key={category} style={{ marginBottom: '24px' }}>
              <h4 style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>
                {category}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {nodes.map((node) => (
                  <div
                    key={node.name}
                    draggable
                    onDragStart={(e) => handleDragStart(e, node)}
                    style={{
                      padding: '12px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      cursor: 'grab',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{node.icon}</span>
                    <div>
                      <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>
                        {node.type}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '12px' }}>
                        {node.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default AddNodes
