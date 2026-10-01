"""Regression entry point; historical defect evidence is in git 08f8a3e.
Runs desired behavior checks after R1-R3 fixes, without live services.
"""
from reliability_regression import *

if __name__ == "__main__":
    unittest.main(verbosity=2)
