# Benchmark Report

The generated benchmark report lives at:

[evaluation/results/benchmark_report.md](../evaluation/results/benchmark_report.md)

Regenerate all result files with:

```bash
cd evaluation/scripts
python eval_extraction.py
python eval_retrieval.py
python eval_verification.py
python eval_manipulation.py
python eval_latency.py
python ../ablation/run_ablation.py
```
