'use client';

import { useCallback, useState, useMemo } from 'react';
import { Container, Checkbox, Group, MultiSelect } from '@mantine/core';
import NetworkGraph from '../components/NetworkGraph';
import NodeDetail from '../components/NodeDetail';
import EdgeDetail from '../components/EdgeDetail';
import { nodes as nodeData } from '../data/nodes';
import { edges as edgeData } from '../data/edges';
import { ExtendedNode, ExtendedEdge } from '../types';

export default function Home() {
  const [selectedNode, setSelectedNode] = useState<ExtendedNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<ExtendedEdge | null>(null);
  const [activeRelations, setActiveRelations] = useState<string[]>([
    'background',
    'method',
    'gap',
    'future',
    'objective',
  ]);
  const [activeArticles, setActiveArticels] = useState<string[]>([]);

  const filteredNodes = useMemo(() => {
      return nodeData.filter((node) => {
      if (activeArticles.length === 0) return true;
      return activeArticles.includes(node.label || '');
    })
  }, [activeArticles]);

  const filteredEdges = useMemo(() => {    
      return edgeData.filter((edge) => {
      if (activeRelations.length === 0) return true;
      return activeRelations.includes(edge.relation || '');
    });
  }, [activeRelations]);

  const handleNodeClick = useCallback((node: ExtendedNode) => {
    setSelectedEdge(null);
    setSelectedNode(node);
  }, []);

  const handleEdgeClick = useCallback ((edge: ExtendedEdge) => {
    setSelectedNode(null);
    setSelectedEdge(edge);
  }, []);

  return (
    <Container size="xl" py="md">
      <h1>Peta Konsep - Visualisasi Artikel</h1>

      <MultiSelect
        label="Tampilkan Artikel"
        placeholder="Pilih artikel"
        value={activeArticles}
        onChange={(e) => {
          setActiveArticels(e);
          setSelectedNode(null);
        }}
        data={nodeData.map((node) => ({
          value: node.label || '',
          label: node.title || node.label || '',
        }))}
        searchable
        clearable
        mt="md"
      />

      <Group mt="md" style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '1rem' }}>
        <Checkbox.Group
          value={activeRelations}
          onChange={setActiveRelations}
          label="Tampilkan jenis relasi:"
        >
          <Group mt="xs">
            <Checkbox value="background" label="Background" />
            <Checkbox value="method" label="Method" />
            <Checkbox value="gap" label="Gap" />
            <Checkbox value="future" label="Future" />
            <Checkbox value="objective" label="Objective" />
          </Group>
        </Checkbox.Group>
        <NetworkGraph
          nodes={filteredNodes}
          edges={filteredEdges}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
        />
        <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} />
        <EdgeDetail edge={selectedEdge} onClose={() => setSelectedEdge(null)} />
      </Group>
    </Container>
  );
}
