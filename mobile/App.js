import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const WEBSITE_URL = 'http://192.168.0.206:3000';

export default function App() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const onHardwareBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }

      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBackPress
    );

    return () => subscription.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: WEBSITE_URL }}
        onNavigationStateChange={(state) => {
          setCanGoBack(state.canGoBack);
        }}
        onLoadProgress={({ nativeEvent }) => {
          if (nativeEvent.progress >= 0.9) {
            setIsLoading(false);
          }
        }}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
        onHttpError={() => setIsLoading(false)}
        setSupportMultipleWindows={false}
      />

      {isLoading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#111111" />
        </View>
      ) : null}

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
