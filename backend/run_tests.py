#!/usr/bin/env python3
"""
AURA-BOLT Test Runner
Executes comprehensive network simulator tests and outputs detailed results.
"""

import sys
import os
import unittest

backend_dir = os.path.abspath(os.path.dirname(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    tests_dir = os.path.join(backend_dir, "tests")
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=tests_dir, pattern="test_*.py")
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
