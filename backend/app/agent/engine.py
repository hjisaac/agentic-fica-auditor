import os
import uuid
import json
import datetime
import logging

logger = logging.getLogger("fc_agent")
from backend.app.agent.sandbox import CaseSandboxFactory
from backend.app.agent.tools import (
    dha_identity_check,
    cipc_business_lookup,
    pep_sanctions_screen,
    bank_account_verify,
    adverse_media_check
)
from backend.app.models import Case, TransactionType, AuditStatus, StepType
from backend.app.agent.prompts import (
    KYC_SYSTEM_INSTRUCTION,
    get_kyc_user_prompt,
    REACT_DECISION_PROMPT,
    KYB_SYSTEM_INSTRUCTION,
    get_kyb_user_prompt
)
# Conditionally import Google GenAI SDK for live execution
HAS_GEMINI = False
try:
    from google import genai
    from google.genai import types
    from pydantic import BaseModel, Field
    HAS_GEMINI = True
except ImportError:
    pass

if HAS_GEMINI:
    class FicaDecision(BaseModel):
        status: str = Field(description="The final FICA compliance recommendation: must be exactly ACCEPT, REVIEW, or REJECT")
        risk_score: int = Field(description="The calculated risk score between 0 and 100")
        summary: str = Field(description="A comprehensive compliance recap report outlining the case findings.")
        clean_steps: list[str] = Field(default=[], description="A list of 3-5 clean, high-level compliance milestones representing the key clean audit path for a compliance officer to see.")
else:
    class FicaDecision:
        status: str = AuditStatus.ACCEPT.value
        risk_score: int = 10
        summary: str = ""
        clean_steps: list = []

def save_case_to_db(outcome: dict, traces: list) -> dict:
    case_obj = Case.create(
        id=outcome["id"],
        parent_case_id=outcome.get("parent_case_id"),
        timestamp=datetime.datetime.now().isoformat(),
        type=outcome["type"],
        target_name=outcome["target_name"],
        status=outcome["status"],
        risk_score=outcome["risk_score"],
        summary=outcome.get("summary", ""),
        sandbox_hash=outcome["sandbox_hash"],
        traces_json=json.dumps(traces)
    )
    return outcome

class ComplianceAgentEngine:
    """
    Orchestrates compliance checks using the custom ReAct agent reasoning pattern.
    If GEMINI_API_KEY is present, runs live function-calling loops using Gemini SDK.
    Otherwise, falls back to deterministic local mock verification traces.
    """
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        
        has_valid_key = (
            self.api_key is not None 
            and len(self.api_key.strip()) > 0 
            and "your-gemini-api-key" not in self.api_key
        )
        
        self.live_mode = HAS_GEMINI and has_valid_key
        
        if self.live_mode:
            logger.info("Live Agent Mode enabled (utilizing live Gemini API directly).")
            self.real_client = genai.Client(api_key=self.api_key)
        else:
            logger.info("Offline/Mock Agent Mode enabled.")

    def verify_individual(self, first_names: str, last_name: str, id_number: str, account_number: str = None, bank_name: str = None, parent_case_id: str = None) -> dict:
        full_name = f"{first_names} {last_name}"
        
        if self.live_mode:
            try:
                return self._verify_individual_client(self.real_client, first_names, last_name, id_number, account_number, bank_name, parent_case_id)
            except Exception as e:
                logger.exception(f"Live verification failed for {full_name}, falling back to mock.")
                
        return self._verify_individual_mock(first_names, last_name, id_number, account_number, bank_name, parent_case_id)

    def verify_business(self, company_name: str, registration_number: str) -> dict:
        if self.live_mode:
            try:
                return self._verify_business_client(self.real_client, company_name, registration_number)
            except Exception as e:
                logger.exception(f"Live verification failed for {company_name}, falling back to mock.")
                
        return self._verify_business_mock(company_name, registration_number)

    # =========================================================================
    # LIVE GEMINI RECONCILIATION LOOPS (Function-Calling Agents)
    # =========================================================================
    
    def _verify_individual_client(self, client, first_names: str, last_name: str, id_number: str, account_number: str = None, bank_name: str = None, parent_case_id: str = None) -> dict:
        full_name = f"{first_names} {last_name}"
        case_id = f"CASE-KYC-{uuid.uuid4().hex[:8].upper()}"
        
        traces = []
        step_idx = 1
        
        def add_trace(step_type, content, name=None, is_clean=False):
            nonlocal step_idx
            derived_name = name
            if not derived_name:
                if step_type == StepType.ACTION.value:
                    if "(" in content:
                        derived_name = content.split("(")[0].strip()
                    else:
                        derived_name = "action_step"
                elif step_type == StepType.THOUGHT.value:
                    derived_name = "reasoning_thought"
                elif step_type == StepType.OBSERVATION.value:
                    derived_name = "observation_response"
                elif step_type == StepType.DECISION.value:
                    derived_name = "audit_decision"
                else:
                    derived_name = step_type.lower()
            traces.append({
                "timestamp": datetime.datetime.now().isoformat(),
                "type": step_type,
                "name": derived_name,
                "content": content,
                "is_clean": is_clean,
                "step_index": step_idx
            })
            step_idx += 1

        tool_map = {
            "dha_identity_check": dha_identity_check,
            "pep_sanctions_screen": pep_sanctions_screen,
            "adverse_media_check": adverse_media_check,
            "bank_account_verify": bank_account_verify
        }
        tools = [dha_identity_check, pep_sanctions_screen, adverse_media_check, bank_account_verify]

        with CaseSandboxFactory(case_id, full_name, "KYC_Individual") as sandbox:
            sandbox.log(f"Gemini Agent starting FICA deterministic baseline checks for {full_name}...")
            add_trace(StepType.THOUGHT.value, "Starting deterministic baseline gathering phase.", is_clean=False)
            
            # 1. DHA Check
            add_trace(StepType.ACTION.value, f"dha_identity_check(id_number='{id_number}')", is_clean=False)
            dha_res = sandbox.run_tool(dha_identity_check, id_number=id_number)
            add_trace(StepType.OBSERVATION.value, json.dumps(dha_res), is_clean=False)
            
            # 2. PEP/Sanctions screening
            add_trace(StepType.ACTION.value, f"pep_sanctions_screen(full_name='{full_name}')", is_clean=False)
            pep_res = sandbox.run_tool(pep_sanctions_screen, full_name=full_name)
            add_trace(StepType.OBSERVATION.value, json.dumps(pep_res), is_clean=False)
            
            # 3. Adverse media check
            add_trace(StepType.ACTION.value, f"adverse_media_check(full_name='{full_name}')", is_clean=False)
            media_res = sandbox.run_tool(adverse_media_check, full_name=full_name)
            add_trace(StepType.OBSERVATION.value, json.dumps(media_res), is_clean=False)
            
            # 4. Bank Account Verification
            bank_res = None
            if account_number and bank_name:
                add_trace(StepType.ACTION.value, f"bank_account_verify(account_number='{account_number}', bank_name='{bank_name}')", is_clean=False)
                bank_res = sandbox.run_tool(bank_account_verify, account_number=account_number, bank_name=bank_name, id_number=id_number, full_name=full_name)
                add_trace(StepType.OBSERVATION.value, json.dumps(bank_res), is_clean=False)
            
            baseline_results = {
                "dha_identity_check": dha_res,
                "pep_sanctions_screen": pep_res,
                "adverse_media_check": media_res,
                "bank_account_verify": bank_res
            }
            
            system_instruction = KYC_SYSTEM_INSTRUCTION
            user_prompt = get_kyc_user_prompt(full_name, id_number, baseline_results)
            
            chat = client.chats.create(
                model='gemini-2.5-flash',
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    tools=tools,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                    temperature=0.1
                )
            )
            
            # Run structured ReAct loop with explicit reasoning tracing
            loop_active = True
            max_iterations = 6
            iteration = 0
            current_prompt = user_prompt
            
            status = AuditStatus.REVIEW.value
            risk_score = 50
            summary = "Audit incomplete."
            clean_steps = []
            
            while loop_active and iteration < max_iterations:
                iteration += 1
                response = chat.send_message(current_prompt)
                
                # Parse output
                thought = ""
                tool_calls = response.function_calls or []
                
                text_content = response.text or ""
                if "Thought:" in text_content:
                    thought = text_content.split("Thought:")[-1].split("Action:")[0].strip()
                else:
                    thought = text_content.strip()
                    
                if thought:
                    add_trace(StepType.THOUGHT.value, thought, is_clean=False)
                    sandbox.log(f"Agent Thought: {thought}")
                    
                if tool_calls:
                    call = tool_calls[0]
                    func_name = call.name
                    args = call.args
                    
                    add_trace(StepType.ACTION.value, f"{func_name}(**{json.dumps(args)})", name=func_name, is_clean=False)
                    sandbox.log(f"Agent Action: Call {func_name} with {json.dumps(args)}")
                    
                    # Execute tool in secure sandbox
                    if func_name in tool_map:
                        obs = sandbox.run_tool(tool_map[func_name], **args)
                        obs_str = json.dumps(obs)
                        add_trace(StepType.OBSERVATION.value, obs_str, is_clean=False)
                        sandbox.log(f"Agent Observation: {obs_str}")
                        
                        # Feed observation back to chat
                        current_prompt = types.Part.from_function_response(
                            name=func_name,
                            response={'result': obs}
                        )
                    else:
                        obs_str = f"Error: Tool '{func_name}' not found."
                        add_trace(StepType.OBSERVATION.value, obs_str, is_clean=False)
                        current_prompt = obs_str
                else:
                    # No tool calls, loop ends
                    loop_active = False
            
            # Final synthesis step to enforce structured schema mapping
            decision_prompt = REACT_DECISION_PROMPT
            
            decision_response = chat.send_message(
                types.Part.from_text(text=decision_prompt)
            )
            
            decision_data = json.loads(decision_response.text)
            status = decision_data.get("status", AuditStatus.REVIEW.value).upper()
            risk_score = int(decision_data.get("risk_score", 50))
            summary = decision_data.get("summary", "FICA Audit complete.")
            clean_steps = decision_data.get("clean_steps", [])
            
            # Save clean audit path steps
            for step in clean_steps:
                add_trace(StepType.THOUGHT.value, step, is_clean=True)
                
            add_trace(StepType.DECISION.value, f"FICA Recommendation: {status}. Risk: {risk_score}/100. Summary: {summary}", is_clean=True)
            sandbox.log(f"Agent Decision: {status} (Risk: {risk_score}/100) - {summary}")
 
        outcome = {
            "id": case_id,
            "parent_case_id": parent_case_id,
            "type": TransactionType.KYC.value,
            "target_name": full_name,
            "status": status,
            "risk_score": risk_score,
            "summary": summary,
            "sandbox_hash": sandbox.result_signature
        }
        return save_case_to_db(outcome, traces)

    def _verify_business_client(self, client, company_name: str, registration_number: str) -> dict:
        case_id = f"CASE-KYB-{uuid.uuid4().hex[:8].upper()}"
        traces = []
        step_idx = 1
        
        def add_trace(step_type, content, name=None, is_clean=False):
            nonlocal step_idx
            derived_name = name
            if not derived_name:
                if step_type == StepType.ACTION.value:
                    if "(" in content:
                        derived_name = content.split("(")[0].strip()
                    else:
                        derived_name = "action_step"
                elif step_type == StepType.THOUGHT.value:
                    derived_name = "reasoning_thought"
                elif step_type == StepType.OBSERVATION.value:
                    derived_name = "observation_response"
                elif step_type == StepType.DECISION.value:
                    derived_name = "audit_decision"
                else:
                    derived_name = step_type.lower()
            traces.append({
                "timestamp": datetime.datetime.now().isoformat(),
                "type": step_type,
                "name": derived_name,
                "content": content,
                "is_clean": is_clean,
                "step_index": step_idx
            })
            step_idx += 1

        tool_map = {
            "cipc_business_lookup": cipc_business_lookup,
            "pep_sanctions_screen": pep_sanctions_screen,
            "adverse_media_check": adverse_media_check
        }
        tools = [cipc_business_lookup, pep_sanctions_screen, adverse_media_check]

        with CaseSandboxFactory(case_id, company_name, "KYB_Business") as sandbox:
            sandbox.log(f"Gemini Agent starting corporate FICA KYB audit for {company_name}...")
            add_trace(StepType.THOUGHT.value, "Starting corporate baseline gathering phase.", is_clean=False)
            
            # 1. CIPC Lookup
            add_trace(StepType.ACTION.value, f"cipc_business_lookup(registration_number='{registration_number}')", is_clean=False)
            cipc_res = sandbox.run_tool(cipc_business_lookup, registration_number=registration_number)
            add_trace(StepType.OBSERVATION.value, json.dumps(cipc_res), is_clean=False)
            
            # 2. PEP Screen
            add_trace(StepType.ACTION.value, f"pep_sanctions_screen(full_name='{company_name}')", is_clean=False)
            pep_res = sandbox.run_tool(pep_sanctions_screen, full_name=company_name)
            add_trace(StepType.OBSERVATION.value, json.dumps(pep_res), is_clean=False)
            
            # 3. Adverse Media Scan
            add_trace(StepType.ACTION.value, f"adverse_media_check(full_name='{company_name}')", is_clean=False)
            media_res = sandbox.run_tool(adverse_media_check, full_name=company_name)
            add_trace(StepType.OBSERVATION.value, json.dumps(media_res), is_clean=False)
            
            # 4. Spawning child KYC checks for directors
            director_statuses = []
            if cipc_res.get("status") == AuditStatus.ACCEPT.value:
                directors = cipc_res.get("directors", [])
                sandbox.log(f"Found {len(directors)} directors. Spawning child individual checks...")
                for d in directors:
                    d_name = f"{d['first_names']} {d['last_name']}"
                    add_trace(StepType.THOUGHT.value, f"Launching recursive child FICA KYC audit for director '{d_name}'", is_clean=False)
                    
                    dir_res = self.verify_individual(
                        first_names=d["first_names"],
                        last_name=d["last_name"],
                        id_number=d["id_number"],
                        parent_case_id=case_id
                    )
                    
                    d_status = dir_res.get("status", AuditStatus.REJECT.value)
                    d_risk = dir_res.get("risk_score", 100)
                    director_statuses.append({
                        "name": d_name,
                        "status": d_status,
                        "risk_score": d_risk,
                        "case_id": dir_res.get("id")
                    })
                    add_trace(StepType.OBSERVATION.value, f"Recursive UBO Check for '{d_name}': {d_status} (Risk: {d_risk}/100). Case ID: {dir_res['id']}", is_clean=False)
                    
            baseline_results = {
                "cipc_business_lookup": cipc_res,
                "pep_sanctions_screen": pep_res,
                "adverse_media_check": media_res,
                "director_kyc_checks": director_statuses
            }
            
            system_instruction = KYB_SYSTEM_INSTRUCTION
            user_prompt = get_kyb_user_prompt(company_name, registration_number, baseline_results)
 
            chat = client.chats.create(
                model='gemini-2.5-flash',
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    tools=tools,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                    temperature=0.1
                )
            )
            
            loop_active = True
            max_iterations = 6
            iteration = 0
            current_prompt = user_prompt
            
            status = AuditStatus.REVIEW.value
            risk_score = 50
            summary = "Audit incomplete."
            clean_steps = []
            
            while loop_active and iteration < max_iterations:
                iteration += 1
                response = chat.send_message(current_prompt)
                
                thought = ""
                tool_calls = response.function_calls or []
                
                text_content = response.text or ""
                if "Thought:" in text_content:
                    thought = text_content.split("Thought:")[-1].split("Action:")[0].strip()
                else:
                    thought = text_content.strip()
                    
                if thought:
                    add_trace(StepType.THOUGHT.value, thought, is_clean=False)
                    sandbox.log(f"Agent Thought: {thought}")
                    
                if tool_calls:
                    call = tool_calls[0]
                    func_name = call.name
                    args = call.args
                    
                    add_trace(StepType.ACTION.value, f"{func_name}(**{json.dumps(args)})", name=func_name, is_clean=False)
                    sandbox.log(f"Agent Action: Call {func_name} with {json.dumps(args)}")
                    
                    if func_name in tool_map:
                        obs = sandbox.run_tool(tool_map[func_name], **args)
                        obs_str = json.dumps(obs)
                        add_trace(StepType.OBSERVATION.value, obs_str, is_clean=False)
                        sandbox.log(f"Agent Observation: {obs_str}")
                        
                        current_prompt = types.Part.from_function_response(
                            name=func_name,
                            response={'result': obs}
                        )
                    else:
                        obs_str = f"Error: Tool '{func_name}' not found."
                        add_trace(StepType.OBSERVATION.value, obs_str, is_clean=False)
                        current_prompt = obs_str
                else:
                    loop_active = False
            
            decision_prompt = REACT_DECISION_PROMPT
            
            decision_response = chat.send_message(
                types.Part.from_text(text=decision_prompt)
            )
            
            decision_data = json.loads(decision_response.text)
            status = decision_data.get("status", AuditStatus.REVIEW.value).upper()
            risk_score = int(decision_data.get("risk_score", 50))
            summary = decision_data.get("summary", "FICA KYB complete.")
            clean_steps = decision_data.get("clean_steps", [])
            
            for d in director_statuses:
                if d["status"] == AuditStatus.REJECT.value:
                    status = AuditStatus.REJECT.value
                    risk_score = max(risk_score, 90)
                    if d["name"] not in summary:
                        summary += f" Rejected due to failed verification for director {d['name']}."
            
            # Save clean audit path steps
            for step in clean_steps:
                add_trace(StepType.THOUGHT.value, step, is_clean=True)
                
            add_trace(StepType.DECISION.value, f"FICA KYB Status: {status}. Corporate Risk: {risk_score}/100. Summary: {summary}", is_clean=True)
            sandbox.log(f"Agent Decision: {status} (Risk: {risk_score}/100) - {summary}")
            
        outcome = {
            "id": case_id,
            "type": TransactionType.KYB.value,
            "target_name": company_name,
            "status": status,
            "risk_score": risk_score,
            "summary": summary,
            "sandbox_hash": sandbox.result_signature
        }
        return save_case_to_db(outcome, traces)


    # =========================================================================
    # OFFLINE/MOCK TRACE LOGIC
    # =========================================================================

    def _verify_individual_mock(self, first_names: str, last_name: str, id_number: str, account_number: str = None, bank_name: str = None, parent_case_id: str = None) -> dict:
        full_name = f"{first_names} {last_name}"
        case_id = f"CASE-KYC-{uuid.uuid4().hex[:8].upper()}"
        traces = []
        step_idx = 1
        
        def add_trace(step_type, content, name=None, is_clean=False):
            nonlocal step_idx
            derived_name = name
            if not derived_name:
                if step_type == StepType.ACTION.value:
                    if "(" in content:
                        derived_name = content.split("(")[0].strip()
                    else:
                        derived_name = "action_step"
                elif step_type == StepType.THOUGHT.value:
                    derived_name = "reasoning_thought"
                elif step_type == StepType.OBSERVATION.value:
                    derived_name = "observation_response"
                elif step_type == StepType.DECISION.value:
                    derived_name = "audit_decision"
                else:
                    derived_name = step_type.lower()
            traces.append({
                "timestamp": datetime.datetime.now().isoformat(),
                "type": step_type,
                "name": derived_name,
                "content": content,
                "is_clean": is_clean,
                "step_index": step_idx
            })
            step_idx += 1

        risk_score = 10
        status = AuditStatus.ACCEPT.value
        summary = ""

        with CaseSandboxFactory(case_id, full_name, "KYC_Individual") as sandbox:
            sandbox.log(f"Mock Agent starting FICA audit for {full_name}...")
            
            add_trace(StepType.THOUGHT.value, "Starting deterministic baseline gathering phase.", is_clean=False)
            add_trace(StepType.ACTION.value, f"dha_identity_check(id_number='{id_number}')", is_clean=False)
            dha_result = sandbox.run_tool(dha_identity_check, id_number=id_number)
            add_trace(StepType.OBSERVATION.value, json.dumps(dha_result), is_clean=False)
            
            if dha_result.get("status") == AuditStatus.REJECT.value:
                status = AuditStatus.REJECT.value
                risk_score = 100
                summary = "FICA check rejected: Identity not found in DHA registry."
                add_trace(StepType.DECISION.value, "Identity check failed. The ID number was not found in the Department of Home Affairs registry. Status: REJECT.", is_clean=True)
            else:
                add_trace(StepType.THOUGHT.value, "Identity confirmed. Now I must screen the individual against politically exposed persons (PEP) registers.", is_clean=False)
                add_trace(StepType.ACTION.value, f"pep_sanctions_screen(full_name='{full_name}')", is_clean=False)
                aml_result = sandbox.run_tool(pep_sanctions_screen, full_name=full_name)
                add_trace(StepType.OBSERVATION.value, json.dumps(aml_result), is_clean=False)
                
                # Adverse Media Screen
                add_trace(StepType.ACTION.value, f"adverse_media_check(full_name='{full_name}')", is_clean=False)
                media_result = sandbox.run_tool(adverse_media_check, full_name=full_name)
                add_trace(StepType.OBSERVATION.value, json.dumps(media_result), is_clean=False)
                
                bank_status = AuditStatus.ACCEPT.value
                if account_number and bank_name:
                    add_trace(StepType.THOUGHT.value, "Watchlist screening complete. Verifying bank account matching AVS records.", is_clean=False)
                    add_trace(StepType.ACTION.value, f"bank_account_verify(account_number='{account_number}', bank_name='{bank_name}')", is_clean=False)
                    bank_result = sandbox.run_tool(
                        bank_account_verify, 
                        account_number=account_number, 
                        bank_name=bank_name, 
                        id_number=id_number, 
                        full_name=full_name
                    )
                    add_trace(StepType.OBSERVATION.value, json.dumps(bank_result), is_clean=False)
                    bank_status = bank_result.get("status", AuditStatus.ACCEPT.value)

                if aml_result.get("match_found"):
                    max_risk = aml_result.get("max_risk_level", "Low")
                    if max_risk == "High":
                        status = AuditStatus.REJECT.value
                        risk_score = 95
                    elif max_risk == "Medium":
                        status = AuditStatus.REVIEW.value
                        risk_score = 60
                
                if media_result.get("match_found"):
                    max_sev = media_result.get("max_severity", "None")
                    if max_sev in ["High", "Medium"]:
                        status = AuditStatus.REVIEW.value if status == AuditStatus.ACCEPT.value else status
                        risk_score = max(risk_score, 65)

                if bank_status == AuditStatus.REVIEW.value and status == AuditStatus.ACCEPT.value:
                    status = AuditStatus.REVIEW.value
                    risk_score = 45
                elif bank_status == AuditStatus.REJECT.value:
                    status = AuditStatus.REJECT.value
                    risk_score = 80
                
                summary = f"FICA verification complete for individual {full_name}. DHA check passed. "
                if aml_result.get("match_found"):
                    summary += f"PEP hit detected ({aml_result.get('max_risk_level')} risk). "
                else:
                    summary += "PEP screening clean. "
                if media_result.get("match_found"):
                    summary += f"Adverse news articles matched (Severity: {media_result.get('max_severity')}). "
                else:
                    summary += "Adverse media screening clean. "
                if bank_status != AuditStatus.ACCEPT.value:
                    summary += f"Bank validation status: {bank_status}."
                else:
                    summary += "Bank ownership match validated."
                
                # Add Clean steps
                add_trace(StepType.THOUGHT.value, f"Identity check validated in DHA registry for {full_name}.", is_clean=True)
                if aml_result.get("match_found"):
                    add_trace(StepType.THOUGHT.value, f"PEP warning: Target listed in Politically Exposed Persons registers.", is_clean=True)
                else:
                    add_trace(StepType.THOUGHT.value, "Screened PEP & Global watchlists: no records found.", is_clean=True)
                if media_result.get("match_found"):
                    add_trace(StepType.THOUGHT.value, f"Adverse News hit: negative press detected.", is_clean=True)
                else:
                    add_trace(StepType.THOUGHT.value, "Screened adverse media registry: no matches.", is_clean=True)
                if account_number and bank_name:
                    add_trace(StepType.THOUGHT.value, f"AVS bank matching status: {bank_status}.", is_clean=True)

                decision_summary = f"FICA verification complete. Final Recommendation: {status}. Calculated Risk Score: {risk_score}/100. Summary: {summary}"
                add_trace(StepType.DECISION.value, decision_summary, is_clean=True)

        outcome = {
            "id": case_id,
            "parent_case_id": parent_case_id,
            "type": TransactionType.KYC.value,
            "target_name": full_name,
            "status": status,
            "risk_score": risk_score,
            "summary": summary,
            "sandbox_hash": sandbox.result_signature
        }
        return save_case_to_db(outcome, traces)
        return save_case_to_db(outcome, traces)

    def _verify_business_mock(self, company_name: str, registration_number: str) -> dict:
        case_id = f"CASE-KYB-{uuid.uuid4().hex[:8].upper()}"
        traces = []
        step_idx = 1
        
        def add_trace(step_type, content, name=None, is_clean=False):
            nonlocal step_idx
            derived_name = name
            if not derived_name:
                if step_type == StepType.ACTION.value:
                    if "(" in content:
                        derived_name = content.split("(")[0].strip()
                    else:
                        derived_name = "action_step"
                elif step_type == StepType.THOUGHT.value:
                    derived_name = "reasoning_thought"
                elif step_type == StepType.OBSERVATION.value:
                    derived_name = "observation_response"
                elif step_type == StepType.DECISION.value:
                    derived_name = "audit_decision"
                else:
                    derived_name = step_type.lower()
            traces.append({
                "timestamp": datetime.datetime.now().isoformat(),
                "type": step_type,
                "name": derived_name,
                "content": content,
                "is_clean": is_clean,
                "step_index": step_idx
            })
            step_idx += 1

        risk_score = 15
        status = AuditStatus.ACCEPT.value
        target_name = company_name
        summary = ""

        with CaseSandboxFactory(case_id, company_name, "KYB_Business") as sandbox:
            sandbox.log(f"Mock Agent starting FICA KYB audit for {company_name}...")
            
            add_trace(StepType.THOUGHT.value, "Starting corporate baseline gathering phase.", is_clean=False)
            add_trace(StepType.ACTION.value, f"cipc_business_lookup(registration_number='{registration_number}')", is_clean=False)
            cipc_result = sandbox.run_tool(cipc_business_lookup, registration_number=registration_number)
            add_trace(StepType.OBSERVATION.value, json.dumps(cipc_result), is_clean=False)
            
            if cipc_result.get("status") != AuditStatus.ACCEPT.value:
                status = AuditStatus.REJECT.value
                risk_score = 100
                summary = "KYB check rejected: CIPC registration number not found."
                add_trace(StepType.DECISION.value, f"KYB rejected: registration number not found. Status: {AuditStatus.REJECT.value}.", is_clean=True)
            else:
                target_name = cipc_result["company_name"]
                
                add_trace(StepType.THOUGHT.value, "CIPC record found. Now I must screen the corporate entity name against sanctions lists.", is_clean=False)
                add_trace(StepType.ACTION.value, f"pep_sanctions_screen(full_name='{target_name}')", is_clean=False)
                entity_aml = sandbox.run_tool(pep_sanctions_screen, full_name=target_name)
                add_trace(StepType.OBSERVATION.value, json.dumps(entity_aml), is_clean=False)
                
                # Adverse media
                add_trace(StepType.ACTION.value, f"adverse_media_check(full_name='{target_name}')", is_clean=False)
                entity_media = sandbox.run_tool(adverse_media_check, full_name=target_name)
                add_trace(StepType.OBSERVATION.value, json.dumps(entity_media), is_clean=False)
                
                directors = cipc_result.get("directors", [])
                director_statuses = []
                for d in directors:
                    d_name = f"{d['first_names']} {d['last_name']}"
                    dir_res = self.verify_individual(
                        first_names=d["first_names"],
                        last_name=d["last_name"],
                        id_number=d["id_number"],
                        parent_case_id=case_id
                    )
                    d_status = dir_res.get("status", AuditStatus.REJECT.value)
                    d_risk = dir_res.get("risk_score", 100)
                    director_statuses.append((d_name, d_status, d_risk))
                    add_trace(StepType.OBSERVATION.value, f"Recursive UBO Check for '{d_name}': {d_status} (Risk: {d_risk}/100). Case ID: {dir_res.get('id')}", is_clean=False)
                    
                comp_status = cipc_result.get("company_status", "Active")
                if comp_status != "Active":
                    status = AuditStatus.REVIEW.value
                    risk_score = 50
                    
                if entity_aml.get("match_found"):
                    status = AuditStatus.REJECT.value
                    risk_score = 95
                    
                for d_name, d_status, d_risk in director_statuses:
                    if d_status == AuditStatus.REJECT.value:
                        status = AuditStatus.REJECT.value
                        risk_score = max(risk_score, 90)
                    elif d_status == AuditStatus.REVIEW.value and status == AuditStatus.ACCEPT.value:
                        status = AuditStatus.REVIEW.value
                        risk_score = max(risk_score, 55)
                    risk_score = max(risk_score, int(d_risk * 0.8))
                
                summary = f"FICA KYB complete for corporate target {target_name}. CIPC company record is {comp_status}. "
                if entity_aml.get("match_found"):
                    summary += "PEP/Watchlist record matched for corporate name. "
                else:
                    summary += "PEP watchlist clean. "
                if entity_media.get("match_found"):
                    summary += f"Adverse media hits detected (Severity: {entity_media.get('max_severity')}). "
                summary += f"Spawned UBO checks for {len(directors)} directors."
                
                # Add Clean steps
                add_trace(StepType.THOUGHT.value, f"CIPC registry verified. Company status: {comp_status}.", is_clean=True)
                if entity_aml.get("match_found"):
                    add_trace(StepType.THOUGHT.value, "Corporate watchlist alert: match found.", is_clean=True)
                else:
                    add_trace(StepType.THOUGHT.value, "Corporate watchlist screened: no matches.", is_clean=True)
                add_trace(StepType.THOUGHT.value, f"Spawned recursive compliance audits for {len(directors)} Ultimate Beneficial Owners (directors).", is_clean=True)
                for d_name, d_status, d_risk in director_statuses:
                    add_trace(StepType.THOUGHT.value, f"Director '{d_name}' FICA status: {d_status} (Risk: {d_risk}/100).", is_clean=True)
                    
                decision_summary = f"KYB audit complete for '{target_name}'. Final Status: {status}. Risk Score: {risk_score}/100. Summary: {summary}"
                add_trace(StepType.DECISION.value, decision_summary, is_clean=True)
 
        outcome = {
            "id": case_id,
            "type": TransactionType.KYB.value,
            "target_name": target_name,
            "status": status,
            "risk_score": risk_score,
            "summary": summary,
            "sandbox_hash": sandbox.result_signature
        }
        return save_case_to_db(outcome, traces)
