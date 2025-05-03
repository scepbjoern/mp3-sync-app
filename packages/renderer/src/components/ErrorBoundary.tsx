import { Component, ErrorInfo, ReactNode } from 'react';
import { Stack, Text } from '@mantine/core';

interface Props {
  children: ReactNode;
  FallbackComponent?: React.ComponentType<{ error: Error }>;
}

interface State {
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Uncaught error:', error, info);
  }

  render() {
    const { error } = this.state;
    const { children, FallbackComponent } = this.props;

    if (error) {
      if (FallbackComponent) return <FallbackComponent error={error} />;
      return (
        <Stack align="center" justify="center" h="100%">
          <Text color="red">
            Something went wrong: {error.message}
          </Text>
        </Stack>
      );
    }

    return children;
  }
}
