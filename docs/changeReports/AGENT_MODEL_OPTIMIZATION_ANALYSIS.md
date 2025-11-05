# Agent Model Optimization Analysis

**Дата:** 2025-10-24  
**Цель:** Определить, какие агенты могут использовать gpt-4o-mini для дополнительной экономии

## 💰 Pricing Comparison

| Model | Input | Output | Difference |
|-------|-------|--------|------------|
| **gpt-4o** | $2.50/1M | $10.00/1M | Baseline |
| **gpt-4o-mini** | $0.15/1M | $0.60/1M | ✅ **~94% cheaper** |

**Savings example (1M input + 100K output):**
- gpt-4o: $2.50 + $1.00 = $3.50
- gpt-4o-mini: $0.15 + $0.06 = $0.21
- **Savings: $3.29 (94%)**

## 🔍 Agent Analysis

### ✅ 1. ComplexityAssessorAgent → **MINI RECOMMENDED**

**Characteristics:**
- 🎯 **Task:** Simple classification (simple/medium/complex)
- 📝 **Complexity:** Low
- 🚫 **Tools:** None (pure reasoning)
- 📊 **Volume:** VERY HIGH (called for EVERY task)
- ⏱️ **Speed:** Critical (fast assessment needed)
- 🎓 **Quality:** Criteria are clear and explicit

**Why mini works:**
- Clear classification criteria in instructions
- No creative reasoning needed
- Pattern recognition task
- High volume = biggest savings opportunity
- Mini is sufficient for structured classification

**Expected accuracy:**
- gpt-4o: 85-90%
- gpt-4o-mini: 80-85% (acceptable!)

**Savings per 10,000 tasks:**
```
Input: ~250K tokens × 10K = 2.5B tokens
Output: ~150K tokens × 10K = 1.5B tokens

gpt-4o: (2.5 × $2.50) + (1.5 × $10) = $6.25 + $15 = $21.25
mini: (2.5 × $0.15) + (1.5 × $0.60) = $0.375 + $0.90 = $1.28

Savings: $19.97/10K tasks = $20/10K ✅
Annual (120K tasks): $240/year
```

**Recommendation:** ✅ **USE MINI**

---

### ✅ 2. DelegationReviewerAgent → **MINI RECOMMENDED**

**Characteristics:**
- 🎯 **Task:** Binary decision (delegateBack vs handlePersonally)
- 📝 **Complexity:** Low-Medium
- 🚫 **Tools:** None (pure decision-making)
- 📊 **Volume:** HIGH (called often)
- ⏱️ **Speed:** Important
- 🎓 **Quality:** Criteria are explicit

**Why mini works:**
- Binary decision with clear criteria
- Rule-based logic in instructions
- No creative thinking needed
- High volume usage

**Expected accuracy:**
- gpt-4o: 80-85%
- gpt-4o-mini: 75-80% (acceptable for pre-filtering)

**Savings per 10,000 tasks:**
```
Similar to ComplexityAssessor: ~$20/10K tasks
Annual: $240/year ✅
```

**Recommendation:** ✅ **USE MINI** (if integrated)

---

### ❓ 3. TaskPlannerAgent → **KEEP GPT-4O**

**Characteristics:**
- 🎯 **Task:** Generate detailed execution plans
- 📝 **Complexity:** Medium-High
- 🚫 **Tools:** None (planning only)
- 📊 **Volume:** LOW-MEDIUM (only for complex tasks)
- ⏱️ **Speed:** Not critical
- 🎓 **Quality:** CRITICAL (user sees plans directly)

**Why keep gpt-4o:**
- Requires creative planning
- Quality directly impacts user trust
- Needs to understand nuances
- User confirmation step means bad plans visible
- Lower volume = smaller savings

**Expected quality:**
- gpt-4o: 90-95%
- gpt-4o-mini: 75-85% (noticeable drop!)

**Potential savings:** ~$5/10K tasks (not worth quality risk)

**Recommendation:** ❌ **KEEP GPT-4O**

---

### ❌ 4. WorkflowOrchestratorAgent → **MUST USE GPT-4O**

**Characteristics:**
- 🎯 **Task:** Complex workflow orchestration
- 📝 **Complexity:** HIGH
- ✅ **Tools:** YES (MCP Calendar)
- 📊 **Volume:** MEDIUM-HIGH
- ⏱️ **Speed:** Important
- 🎓 **Quality:** CRITICAL (actual task execution)

**Why must use gpt-4o:**
- Complex multi-step reasoning
- Tool coordination required
- Conditional logic handling
- Error recovery needed
- User-facing results

**Expected quality:**
- gpt-4o: 85-90%
- gpt-4o-mini: 60-70% (too low!)

**Risk:** Failed task execution, poor user experience

**Recommendation:** ❌ **MUST USE GPT-4O**

---

### ❌ 5. ReportGeneratorAgent → **KEEP GPT-4O**

**Characteristics:**
- 🎯 **Task:** Synthesize comprehensive reports
- 📝 **Complexity:** HIGH
- 🚫 **Tools:** None (synthesis only)
- 📊 **Volume:** LOW (only complex tasks)
- ⏱️ **Speed:** Not critical
- 🎓 **Quality:** CRITICAL (final user-facing output)

**Why keep gpt-4o:**
- Requires synthesis across multiple results
- Needs to extract key findings
- Quality directly visible to user
- Creative summarization needed
- Low volume = minimal savings

**Expected quality:**
- gpt-4o: 90-95%
- gpt-4o-mini: 70-80% (noticeable drop)

**Potential savings:** ~$3/10K tasks (not worth it)

**Recommendation:** ❌ **KEEP GPT-4O**

---

## 📊 Optimization Recommendation

### Recommended Configuration

| Agent | Model | Reason |
|-------|-------|--------|
| **ComplexityAssessorAgent** | ✅ **gpt-4o-mini** | Simple classification, high volume |
| **DelegationReviewerAgent** | ✅ **gpt-4o-mini** | Binary decision, high volume |
| **TaskPlannerAgent** | ❌ gpt-4o | Quality critical, user-facing |
| **WorkflowOrchestratorAgent** | ❌ gpt-4o | Complex reasoning + tools |
| **ReportGeneratorAgent** | ❌ gpt-4o | Quality critical, synthesis |
| **DecisionAgent** | ❌ gpt-4o | Critical breakdown decisions |
| **ExecutorAgent** | ❌ gpt-4o | Task execution + tools |

### Cost Impact

**Current (all gpt-4o):**
```
10,000 tasks/month
Average: 7 agent calls per task = 70,000 calls

ComplexityAssessor: 10,000 calls × $0.003 = $30
DelegationReviewer: 10,000 calls × $0.003 = $30 (if integrated)
Others: 50,000 calls × $0.003 = $150

Total: $210/month
```

**Optimized (mini for 2 agents):**
```
ComplexityAssessor: 10,000 calls × $0.0002 = $2 ✅
DelegationReviewer: 10,000 calls × $0.0002 = $2 ✅
Others: 50,000 calls × $0.003 = $150

Total: $154/month

Savings: $56/month = $672/year ✅
```

**Additional savings: 27% cost reduction!**

---

## 🎯 Implementation

### Change 1: ComplexityAssessorAgent

```typescript
// Before
export const complexityAssessorAgent = new Agent({
  name: 'ComplexityAssessorAgent',
  model: 'gpt-4o',
  instructions: complexityAssessorInstructions,
  tools: [],
});

// After
export const complexityAssessorAgent = new Agent({
  name: 'ComplexityAssessorAgent',
  model: 'gpt-4o-mini', // ✅ Changed to mini
  instructions: complexityAssessorInstructions,
  tools: [],
});
```

### Change 2: DelegationReviewerAgent (if integrated)

```typescript
// Before
export const delegationReviewerAgent = new Agent({
  name: 'DelegationReviewerAgent',
  model: 'gpt-4o',
  instructions: delegationReviewerInstructions,
  tools: [],
});

// After
export const delegationReviewerAgent = new Agent({
  name: 'DelegationReviewerAgent',
  model: 'gpt-4o-mini', // ✅ Changed to mini
  instructions: delegationReviewerInstructions,
  tools: [],
});
```

---

## ⚠️ Risks & Mitigation

### Risk 1: Accuracy Drop

**Problem:** mini might classify incorrectly more often

**Mitigation:**
- Monitor classification accuracy
- Log all decisions for review
- If accuracy drops below 75%, revert to gpt-4o
- Conservative criteria in prompt help mini

**Acceptable threshold:** 80% accuracy (vs 85% with gpt-4o)

### Risk 2: Slower Response

**Problem:** mini might be slower (counter-intuitive but possible)

**Mitigation:**
- Monitor response times
- If >500ms consistently, consider reverting
- Typically mini is faster, but test in production

**Acceptable threshold:** <300ms average

### Risk 3: Prompt Sensitivity

**Problem:** mini more sensitive to prompt quality

**Mitigation:**
- Our prompts are already high-quality and explicit
- Clear criteria help mini perform well
- If issues, refine prompts for mini

---

## 📈 Expected Outcomes

### Cost Savings

**Per 10,000 tasks:**
- ComplexityAssessor: $20 saved
- DelegationReviewer: $20 saved (if integrated)
- **Total: $40 saved per 10K tasks**

**Annual (120,000 tasks):**
- **$480/year savings**
- Combined with v3.0 specialization: **$6,480 + $480 = $6,960/year**

### Performance

**Speed:**
- mini typically 10-20% faster
- Expected: <200ms for complexity assessment

**Quality:**
- 5-10% accuracy drop acceptable
- Still >80% accuracy expected
- Monitoring will validate

### Volume Impact

**High volume agents benefit most:**
- ComplexityAssessor: Called EVERY task (100% volume)
- DelegationReviewer: Called often (80% volume if integrated)

---

## 🧪 Testing Plan

### Phase 1: A/B Test (Week 1)

```typescript
// Run 1000 tasks through both models
// Compare:
- Accuracy rate
- Response time
- Cost
- User satisfaction (indirect)
```

### Phase 2: Gradual Rollout (Week 2)

```typescript
// If A/B test successful:
- Deploy mini to 10% of traffic
- Monitor for 2-3 days
- If stable, increase to 50%
- Monitor for 2-3 days
- Full rollout
```

### Phase 3: Monitoring (Ongoing)

```typescript
// Track metrics:
- Classification accuracy (manual review sample)
- Response time (p50, p95, p99)
- Error rate
- Cost savings (actual vs expected)
```

---

## ✅ Conclusion

**Recommendation: Use gpt-4o-mini for ComplexityAssessorAgent**

**Rationale:**
1. ✅ Simple classification task (mini excels here)
2. ✅ High volume = maximum savings ($240/year)
3. ✅ Clear criteria in prompt (mini handles well)
4. ✅ Acceptable accuracy trade-off (80-85% vs 85-90%)
5. ✅ Faster response time (bonus!)

**Optional: Use mini for DelegationReviewerAgent if integrated**

**Do NOT use mini for:**
- TaskPlannerAgent (quality critical)
- WorkflowOrchestratorAgent (complexity + tools)
- ReportGeneratorAgent (quality critical)

**Total Additional Savings: $240-480/year** 🎉

---

**Status:** ✅ Ready for Implementation  
**Risk Level:** 🟢 LOW (easy to revert if issues)  
**Impact:** 💰 MEDIUM (additional 27% cost reduction)

