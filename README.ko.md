# Playground

[English](README.md) | **한국어**

JEV/OpenJEV의 공식 서비스가 아닌 독립적인 Three.js 기반 로보틱스 플레이그라운드. React + TypeScript + Vite로 만들었으며 GitHub Pages에서 정적 호스팅할 수 있습니다.

**[플레이그라운드 열기](https://devsangho.github.io/jev-robotics-example/)**

## 서버 없이 바로 사용

1. [Playground에 접속](https://devsangho.github.io/jev-robotics-example/)합니다.
2. **Load Open-Jev · 480 MB**를 누릅니다. 모델을 한 번 내려받고 브라우저에 캐시합니다.
3. 모델이 계산한 후보별 확률과 실제 판단 지연시간을 확인합니다.

Python, 서버 실행, API 키가 필요하지 않습니다. 이 양자화 모델의 실행에는 WebGPU가 필요합니다. WebGPU가 없어도 scripted 데모는 사용할 수 있습니다. 실제 다운로드 진행 상황과 취소 기능을 제공하며, 모델 없이 즉시 사용하는 scripted 데모도 남겨두었습니다.

브라우저 모델은 **Kotoba의 Open-Jev DeBERTa**입니다. AlexWortega Qwen 4B와는 다른 체크포인트입니다. 문장을 생성하지 않고 한 번의 forward pass로 다섯 후보의 점수를 계산합니다. 로보틱스는 이 모델의 학습 도메인 밖이므로 확률이 실제 제어 성공을 보장하지 않습니다.

## 개발자용 실행

```bash
npm ci
npm run dev
```

http://localhost:5173 에서 실행됩니다. `npm run build`로 `dist/`를 만들고 `npm run preview`로 확인합니다. Node.js 22 이상을 사용하세요.

### 구현된 기능과 경계

| 기능 | 동작 |
| --- | --- |
| 3D 플레이그라운드 | Three.js 로봇 팔·카메라 및 Rapier 충돌·중력·그립 제약·놓기 동작 |
| 데모 정책 | 5단계의 결정론적 행동 및 점수. 학습 모델이 아닙니다 |
| OpenJEV 연결 | AlexWortega Qwen 4B NLI 모델을 로컬 Python 서버로 실행하고 실제 entailment 점수로 다음 단계를 선택 |
| 브라우저 모델 | Open-Jev DeBERTa q4를 Transformers.js로 실행. 실제 후보별 확률, WebGPU, 서버 불필요 |
| 반복 실험 | 3개 작업, seed별 초기 위치, 최대 20단계, 실행/일시정지/단일 단계/리셋 |
| 기록 | 브라우저 localStorage에 최대 50개 에피소드, 실제 클라이언트 왕복 시간, 행동 점수, JSON 내보내기 |
| 실제 LIBERO 연동 | 별도 Python CLI로 MuJoCo와 사용자 VLA endpoint에 연결. 설치된 VLA 서버가 필요합니다 |

**브라우저 장면은 LIBERO에서 영감을 받은 물리 데모입니다.** Rapier로 물체·테이블·그릇·그리퍼의 충돌을 처리하고 fixed joint로 잡기를 구현합니다. 손가락이 열린 뒤 중력으로 물체가 떨어지고 목적지에 안착해야 성공입니다. 로봇 팔은 단계별 경로를 따르며 정식 Franka 관절 동역학, 공식 LIBERO 환경 또는 pretrained VLA는 아닙니다. 브라우저 모델에는 시뮬레이터의 텍스트 관측 상태를 입력합니다. 시각적 일반화 성능을 측정하는 실험이 아닙니다. 관측 카메라 미리보기 이미지는 OpenJEV에 전송하지 않습니다.

브라우저용 AlexWortega 4B 변환본은 포함하지 않습니다. 서버 없는 실행을 우선해 Kotoba의 Open-Jev DeBERTa를 사용합니다. DeBERTa 점수는 후보 logits에 원본 모델의 temperature 1.05를 적용한 softmax이며, 로보틱스에 맞춰 보정된 확률은 아닙니다. 선택적으로 사용하는 AlexWortega bridge 점수는 후보별 NLI entailment 확률로 합이 1일 필요가 없습니다.

## 비교·환경 변경·결과 분석

- **A/B comparison:** Open-Jev를 로드하거나 선택적 bridge를 연결한 뒤 비교를 시작합니다. 스크립트 정책과 모델을 같은 작업·seed·물체 초기 위치·목적지·장애물 배치에서 차례로 실행합니다. 완료한 실행에는 비교 ID와 역할을 저장하며 성공 여부, 실제 행동 수, 판단 시간 중앙값/p95와 JSON을 제공합니다. 비교 중 환경 편집은 잠깁니다. 기준 정책은 VLA가 아닌 단계별 스크립트이며 공식 LIBERO 성능 평가가 아닙니다.
- **Change environment:** 동작 사이에 버튼으로 물체·목적지를 정해진 위치로 옮기거나 장애물을 추가·제거합니다. 편집하면 일시정지하며 다시 실행하면 새 관측을 평가합니다. 잡고 있는 물체는 옮길 수 없습니다. 장애물에는 Rapier 충돌체가 있으며 보수적인 경로 검사로 막힌 이동을 멈춥니다. 다섯 행동에는 장애물 회피가 없으므로 장애물을 제거하거나 목적지를 옮겨 진행합니다. 목적지 변경은 렌더링과 물리에 함께 반영됩니다.
- **Decision timeline:** 각 판단의 텍스트 입력, 당시 3D 상태, 후보 점수, 선택 행동과 시간을 확인합니다. 재생은 저장된 장면 상태를 순서대로 보여주며 모델을 다시 호출하거나 현재 에피소드를 변경하지 않습니다. 연속 동영상이 아닌 상태 스냅샷 재생입니다. 완료한 실행은 새로고침 후 **Experiments → Inspect run**에서 볼 수 있습니다. 이전 버전 기록은 장면 정보가 없어도 내보낼 수 있습니다.
- **Speed measurement:** 고정된 관측에서 준비 실행 2회를 제외하고 5·10·20회 판단 시간을 측정합니다. 중앙값, nearest-rank p95, 원시 샘플, 준비 실행 시간, 모델 출처와 브라우저·기기 정보를 내보냅니다. 로봇은 움직이지 않으며 취소하면 부분 결과를 폐기합니다. 브라우저 모델 준비 시간은 파일·토크나이저 단계와 세션 준비 단계로 분리합니다. 파일 단계에는 캐시 접근이 포함되므로 순수 다운로드 시간은 아닙니다. 판단 시간은 입력 처리·worker 또는 bridge 왕복을 포함한 클라이언트 시간이며 GPU 커널 시간과 다릅니다. 스크립트 측정에는 모델 추론이 없다고 표시합니다.

타임라인 내보내기는 `robotics-playground/trace-v2`, 전체 기록은 `robotics-playground/v2` 형식입니다. 완료한 실행은 브라우저에 최대 50개 저장하며 속도 측정 결과는 별도로 내보낼 수 있습니다. 카메라 이미지는 모델 입력에 포함하지 않습니다.

## GitHub Pages 배포

`.github/workflows/deploy.yml`이 `main` push 또는 수동 실행 시 빌드·배포합니다.

1. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
2. 코드를 `main` 브랜치에 push합니다.
3. **Actions → Deploy Playground to GitHub Pages**의 성공을 확인합니다.

현재 remote 기준 예상 주소:

```text
https://devsangho.github.io/jev-robotics-example/
```

배포 빌드는 `GITHUB_REPOSITORY`에서 저장소 이름을 읽어 Vite의 `base`를 자동 설정합니다. `username.github.io` 저장소는 `/`를 사용합니다. 커스텀 도메인을 쓰려면 base를 `/`로 조정하고 `public/CNAME`을 추가하세요.

로컬에서 Pages 경로 검증:

```bash
GITHUB_PAGES=true GITHUB_REPOSITORY=devsangho/jev-robotics-example npm run build
npm run preview
# http://localhost:4173/jev-robotics-example/
```

GitHub Pages는 Python 서버를 실행하지 않습니다. 3D 데모와 실제 Open-Jev DeBERTa는 정적 사이트에서 사용자 기기로 실행합니다. 선택적인 AlexWortega Qwen bridge만 별도 프로세스가 필요합니다. HTTPS 사이트에서 loopback HTTP 접속은 브라우저의 로컬 네트워크 권한 및 정책에 영향을 받습니다. 허용되지 않으면 로컬 개발 주소에서 사용하거나 신뢰된 HTTPS 로컬 프록시를 설정하세요. API 토큰은 필요하지 않습니다.

## 개발자용 선택 기능: AlexWortega OpenJEV 4B

Python 3.11 이상 권장. CUDA, Apple MPS 또는 CPU를 자동 선택합니다. 체크포인트 다운로드에는 약 9 GB 이상의 디스크 공간이 필요하며 모델 및 추론 버퍼를 위한 충분한 메모리도 필요합니다. CPU에서는 float32로 로드하므로 메모리 요구량이 더 큽니다.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt
uvicorn server.app:app --host 127.0.0.1 --port 8000
```

첫 시작에서 `AlexWortega/openjev`, `qwen3.5-4b-nli-v2`를 다운로드합니다. 모델 로딩이 끝난 뒤 사이트의 **Model runtime → Connect OpenJEV**를 누릅니다.

선택 환경 변수:

```bash
OPENJEV_DEVICE=cpu                        # cuda / mps / cpu
OPENJEV_SUBFOLDER=qwen3.5-4b-nli-v2        # 기본값
OPENJEV_REVISION=<hugging-face-commit>     # 재현 가능한 실험용 revision 고정
JEV_ALLOWED_ORIGIN=https://YOURNAME.github.io
```

CORS는 localhost 개발 주소와 지정한 Pages origin만 허용합니다. Origin에는 저장소 경로를 넣지 않습니다. 서버는 기본적으로 loopback에만 바인딩하세요. 모델은 임의 remote Python 코드를 실행하지 않고 Transformers 표준 분류 모델 클래스로 로드합니다.

### Bridge API

`GET /health`: `{service, ready, model, device}`

`POST /score`:

```json
{
  "premise": "The gripper is above the red block and is open.",
  "hypotheses": [
    "The appropriate next action is: close the gripper.",
    "The appropriate next action is: release the object."
  ]
}
```

응답: `scores`는 후보 순서의 entailment 확률, `probabilities`는 후보별 `[contradiction, entailment, neutral]`입니다. 요청당 후보는 1~16개, 텍스트는 2048 token까지 잘립니다. 웹 데모는 5개 후보를 사용합니다.

## 브라우저 모델 구현

[`onnx-community/open-jev-deberta-v3-large-ONNX`](https://huggingface.co/onnx-community/open-jev-deberta-v3-large-ONNX)의 q4 모델을 사용합니다. 그래프와 외부 가중치가 약 478 MB이며 tokenizer와 runtime 자산을 추가로 받습니다.

`src/decision.worker.ts`에서 state/question/option span 입력을 구성하고 한 번의 forward pass와 softmax를 실행합니다. 입력은 기기를 떠나지 않습니다. 최대 문맥은 512 token이며 state는 256 token으로 제한됩니다. 모델 모드에서 텍스트 생성이나 가짜 점수를 사용하지 않습니다.

추론은 별도 Worker에서 실행합니다. GitHub Pages에는 COOP/COEP 헤더를 설정할 수 없어 ONNX의 WASM 연결부는 한 스레드를 사용합니다. 실제 q4 모델의 GatherBlockQuantized 연산은 WebGPU가 필요하며 검증한 runtime의 CPU 경로에서는 지원되지 않습니다. 브라우저 캐시는 저장소 설정에 따라 달라지며, 사이트 데이터를 지우면 가중치를 다시 받습니다. 다운로드 실패·추론 오류는 표시하고 scripted 정책으로 몰래 대체하지 않습니다.

## 실제 LIBERO + VLA 실험

`server/run_libero.py`는 실제 LIBERO API를 사용하는 **통합용 러너**입니다. LIBERO 설치 및 VLA 모델 서버는 포함되지 않습니다. OpenJEV, LIBERO, VLA는 의존성이 다르므로 **별도 Python 환경/프로세스**를 권장합니다.

1. [공식 LIBERO 설치 가이드](https://github.com/Lifelong-Robot-Learning/LIBERO)에 따라 환경·BDDL·initial states를 준비합니다. Pillow와 NumPy가 필요합니다.
2. 위의 OpenJEV bridge를 다른 환경에서 실행합니다.
3. 아래 계약의 VLA `/candidates` endpoint를 준비합니다. 학습된 LIBERO 정책으로 실제 후보 action chunk들을 생성해야 합니다.
4. LIBERO 환경에서 실행합니다.

```bash
python server/run_libero.py \
  --vla-url http://127.0.0.1:9000/candidates \
  --suite libero_spatial --task 0 --episodes 5 \
  --seed 42 --max-steps 300 --output runs/jev.json

# 동일한 후보 생성 설정과 초기 상태로 candidate 0 baseline 비교
python server/run_libero.py \
  --vla-url http://127.0.0.1:9000/candidates \
  --suite libero_spatial --task 0 --episodes 5 \
  --seed 42 --max-steps 300 --baseline --output runs/baseline.json
```

실제 LIBERO 결과는 CLI가 JSON으로 저장합니다. 현재 웹의 기록 화면은 브라우저 데모 기록만 다룹니다. CLI는 official task initial states를 순서대로 사용하며 task별 `env.check_success()`로 성공을 판정합니다. 이것은 사용자 정의 후보 재정렬 프로토콜이며 published leaderboard 결과와 직접 비교할 수 없습니다. 정식 비교에는 suite 전체, 동일한 전처리·seed·후보·rollout horizon 및 충분한 에피소드가 필요합니다.

### VLA endpoint 계약

요청에는 `instruction`, `suite`, `episode`, `reset`, `seed`, `image_png_base64`, `wrist_png_base64`, `proprio`, `action_convention`이 포함됩니다. PNG는 MuJoCo 이미지의 두 축을 뒤집은 256×256 RGB입니다. 모델별 resize/crop, action unnormalization, gripper 변환은 VLA adapter가 수행해야 합니다. `reset: true`에서는 정책 캐시를 초기화하고 전달받은 seed를 사용하세요.

응답 예시(형식 설명용이며 학습 정책 출력이 아님):

```json
{
  "observation_text": "The open gripper is immediately above the red cube.",
  "candidates": [
    {
      "description": "Close the gripper to grasp the red cube.",
      "actions": [[0, 0, 0, 0, 0, 0, 1]]
    },
    {
      "description": "Move the empty gripper away from the cube.",
      "actions": [[0.1, 0, 0, 0, 0, 0, -1]]
    }
  ]
}
```

각 후보는 의미 설명과 1~32개의 7차원 action을 포함합니다. 후보 수는 1~16개입니다. Action은 LIBERO의 OSC_POSE controller 입력으로 변환된 `[-1, 1]` 값이며, 순서는 delta xyz / rotation axis-angle / gripper입니다. Gripper는 -1=open, +1=closed입니다. 모델 정규화 공간의 출력을 그대로 보내면 안 됩니다.

OpenJEV는 VLA가 제공한 **텍스트 관측과 후보 설명**을 평가합니다. 이미지 grounding 또는 candidate description 품질은 adapter 책임이며, OpenJEV가 raw action의 물리적 성공을 검증한다고 볼 수 없습니다. 후보 0을 VLA baseline으로 취급합니다. endpoint 구현은 OpenVLA, π 계열 등 선택한 모델의 배포 방식에 따라 달라집니다.

## 검증

```bash
npm run build
npx playwright install chromium
npm test
python3 -m unittest discover -s server -p 'test_*.py'
```

Playwright는 실제 WebGL canvas, 에피소드 실행·리셋·기록·export·batch seed·모바일 레이아웃, bridge 응답 처리와 오류를 검사합니다. Bridge 테스트는 HTTP fixture를 사용하며 실제 모델 추론 검증은 아닙니다. 대용량 모델의 실추론과 MuJoCo/VLA end-to-end 실행은 해당 모델과 환경이 설치된 장비에서 별도로 검증해야 합니다.

## 자료

- [AlexWortega OpenJEV 모델 및 NLI 인터페이스](https://huggingface.co/AlexWortega/openjev)
- [LIBERO](https://github.com/Lifelong-Robot-Learning/LIBERO)
- [OpenVLA LIBERO evaluation](https://github.com/openvla/openvla/blob/main/experiments/robot/libero/run_libero_eval.py)
- [브라우저 Open-Jev 모델 카드와 입력 규격](https://huggingface.co/onnx-community/open-jev-deberta-v3-large-ONNX)
- [Transformers.js](https://github.com/huggingface/transformers.js)

독립 실험 프로젝트이며 JEV, OpenJEV 또는 LIBERO 공식 서비스가 아닙니다.

방문자 지도: 사용자 지정 MapMyVisitors 스크립트를 트래킹 용도로 유지하고 지도 UI는 숨깁니다. 스크립트는 외부 서비스에서 로드되며, 로컬 모델 추론과는 별개입니다.

실제 브라우저 모델 smoke test: `npm run preview`를 켜고 `node scripts/browser-model-smoke.mjs`를 실행하면 약 480 MB 모델을 실제 다운로드하고 한 번의 판단을 검증합니다. 기본 CI 테스트에는 포함하지 않습니다.

실제 브라우저 모델의 속도 측정과 A/B 비교까지 확인하려면 production preview 실행 후 `SMOKE_EXPERIMENTS=1 node scripts/browser-model-smoke.mjs`를 사용합니다. 로컬 브라우저 캐시를 재사용하며 모델의 작업 성공을 전제하지 않습니다.
