import 'package:flutter/material.dart';

/// Go3net Office mobile app entry point.
///
/// Architecture (see docs/03-architecture.md §4):
///   lib/
///     core/        — api client (Dio), auth, tenant context, offline outbox
///     features/    — attendance/, leave/, payslips/, tasks/, chat/ (each:
///                    presentation / domain / data)
///     design/      — theme, tokens, shared widgets
void main() {
  runApp(const Go3netOfficeApp());
}

class Go3netBrand {
  static const primary = Color(0xFF2DA9DD);
  static const secondary = Color(0xFF1E293B);
  static const accent = Color(0xFF00C2FF);
  static const background = Color(0xFFF8FAFC);
}

class Go3netOfficeApp extends StatelessWidget {
  const Go3netOfficeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Go3net Office',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.system,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Go3netBrand.primary,
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: Go3netBrand.background,
        fontFamily: 'Inter',
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Go3netBrand.primary,
          brightness: Brightness.dark,
          surface: const Color(0xFF111A2E),
        ),
        scaffoldBackgroundColor: const Color(0xFF0B1220),
        fontFamily: 'Inter',
      ),
      home: const _PlaceholderHome(),
    );
  }
}

class _PlaceholderHome extends StatelessWidget {
  const _PlaceholderHome();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Go3netBrand.primary, Go3netBrand.accent],
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Center(
                child: Text(
                  'G',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Go3net Office',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              'Your workplace, in your pocket.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}
