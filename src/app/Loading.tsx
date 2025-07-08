import { Loader } from "@mantine/core";

export default function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Loader size="xl" />
    </div>
  );
}