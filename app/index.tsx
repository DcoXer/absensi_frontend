import { Redirect } from 'expo-router';

// Entry point — redirect based on auth state is handled inside each group layout.
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
