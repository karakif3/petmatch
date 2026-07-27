import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { captureClientError } from "../core/api/observability";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const enriched = new Error(error.message);
    enriched.name = error.name;
    enriched.stack = `${error.stack ?? ""}\n${info.componentStack ?? ""}`.slice(0, 4000);
    void captureClientError(enriched);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View className="flex-1 items-center justify-center bg-bg-primary px-8">
        <Text className="text-2xl font-bold text-text-primary">Bir şeyler ters gitti</Text>
        <Text className="mt-3 text-center text-sm leading-5 text-text-secondary">
          Hata güvenli biçimde kaydedildi. Uygulamayı yeniden deneyebilirsin.
        </Text>
        <Pressable
          onPress={() => this.setState({ error: null })}
          className="mt-6 rounded-xl bg-brand px-6 py-3"
        >
          <Text className="font-bold text-white">Yeniden dene</Text>
        </Pressable>
      </View>
    );
  }
}
