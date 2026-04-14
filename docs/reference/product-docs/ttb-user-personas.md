# TTB Label Verification App - User Personas

## Derived from stakeholder discovery interviews

---

# PERSONA 1: SARAH CHEN

## Deputy Director, Label Compliance Division

---

### Background

Sarah is the Deputy Director of the TTB's Label Compliance Division. She oversees the team of 47 agents responsible for processing approximately 150,000 label applications per year. She's a mid-to-senior career government manager who balances operational demands with institutional memory and leadership expectations.

She's not a frontline label reviewer anymore - she manages the people who do the reviewing. Her days are split between team management, capacity planning, process improvement initiatives, and justifying resource needs to leadership. She's the person who has to explain to her bosses why the team is behind during peak season, and the person who has to make the case for new tools and technology.

### Personal Context

Sarah has a school-age daughter who is playing the lead in her school's production of Annie. She mentioned running late from rehearsal for the interview - she's a working parent juggling a demanding government role with family life. She apologized for the delay and jumped straight into substance, which suggests she's efficient with her time, accustomed to context-switching, and doesn't waste people's time with preamble.

She casually references "the 80s - before my time" when talking about historical staffing levels, which places her as joining TTB sometime in the 1990s or later. She's been around long enough to understand the institutional arc - budget cuts, staffing declines, system migrations - but she isn't a lifer from the pre-digital era like Dave.

### Technology Attitude

Sarah is pragmatic about technology. She's not an early adopter and she's not a resistor - she's the person who evaluates whether something actually works for her team. She championed this AI prototype initiative, which means she's willing to push for modernization, but she's also the person who watched the scanning vendor pilot fail and had to deal with the fallout.

She understands her team's technology spectrum intimately. She described it in concrete terms - Dave still prints his emails, Jenny could have built the tool herself, her own mother is 73 and just learned to video call. She's not speaking abstractly about accessibility; she's giving you a specific usability benchmark based on people she knows personally.

She describes the scanning vendor failure with the specificity of someone who lived through the consequences: "30, 40 seconds sometimes to process a single label. Our agents just went back to doing it by eye because they could do five labels in the time it took the machine to do one." This isn't secondhand - she watched adoption collapse in real time.

### Pain Points

**Staffing deficit is permanent.** The team had over 100 agents in the 1980s. Now it's 47 handling the same or greater volume. Sarah knows this isn't getting fixed through hiring. The only way to increase capacity is to make the existing team faster.

**Routine work crowds out complex work.** She explicitly said "a lot of what we do is just matching" and "my agents spend half their day doing what's essentially data entry verification." She sees her team's talent being wasted on mechanical tasks. She wants the AI to absorb the routine matching so agents can focus on judgment calls.

**Peak season creates crisis.** Sarah mentioned big importers dumping 200-300 applications at once, and Janet from the Seattle office asking about batch processing "for years." Peak season (Q4) isn't just busy - it's a structural bottleneck that the current one-at-a-time workflow can't handle.

**Previous modernization failure.** The scanning vendor pilot poisoned the well. Agents tried it, it was slower than doing the work manually, and they abandoned it. Any new tool carries the burden of that failed precedent. If this prototype is slow or clunky, agents will say "here we go again" and it's dead on arrival.

### Goals

**Immediate:** Get a working prototype that she can show to her team and to leadership. She wants agents to try it and say "this actually helps."

**Strategic:** Use the prototype to justify a larger investment. Marcus said it could "potentially inform future procurement decisions" - Sarah is the person who would make that procurement case. She needs evidence: processing speed, accuracy, agent satisfaction.

**Personal:** Prove that modernization can work in her division. After the scanning vendor failure, her credibility is tied to this initiative succeeding. If it works, she's the leader who brought AI into the compliance workflow. If it fails, she's the leader who wasted time on another tech project.

### Relationship to the Product

Sarah is the **champion and evaluator**. She won't use the tool daily, but she'll demo it to leadership, she'll watch whether agents adopt it, and she'll judge whether it's worth fighting for in budget conversations. The tool's polish, professionalism, and clear value proposition matter to her more than any individual feature.

Her first question when she sees the tool will be: "Would Dave actually use this?"

### Key Quotes

> "My agents spend half their day doing what's essentially data entry verification. It's not that they can't do more complex analysis, it's that they're drowning in routine stuff."

> "If we can't get results back in about 5 seconds, nobody's going to use it. We learned that the hard way."

> "We need something my mother could figure out - she's 73 and just learned to video call her grandkids last year, if that gives you a benchmark."

### Design Implications

- The deployed prototype must look like a serious professional tool, not a hackathon project. Sarah will show it to people.
- Processing time is her #1 concern. She lived through a failure caused by slowness.
- She needs simple metrics she can cite: "The tool processes labels in under 5 seconds" and "It catches government warning errors that agents miss during manual review."
- The batch processing feature directly addresses a pain point she named by name (Janet) and described in detail (200-300 labels at once). Including it signals that you listened to her.

---

# PERSONA 2: DAVE MORRISON

## Senior Compliance Agent - 28 Years of Service

---

### Background

Dave is a senior compliance agent who has been at TTB for 28 years. He started during the Clinton administration (mid-1990s). He has reviewed tens of thousands of labels across his career. He is the institutional knowledge base - the person junior agents go to when they encounter an unusual label they've never seen before.

The interview with Dave was described as a "brief hallway conversation," not a scheduled meeting. This tells you something about Dave: he's not the type to sit down for a formal discovery session. He gave you his opinion directly, briefly, and without sugar-coating. He doesn't waste time.

### Personal Context

Dave is likely in his 50s to early 60s. Sarah described him specifically: "Dave's been here since the Clinton administration and still prints his emails." This isn't a joke - it's a literal description of his relationship with technology. Printing emails is a deliberate choice. Dave has access to a computer. He chooses to interact with information on paper because that's how he processes it.

He's been at TTB through every "modernization" cycle the agency has experienced. He was there for the COLA system going online in 2003. He was there for the automated phone system in 2008. He watched both happen, and he remembers the 2008 phone system as a cautionary tale - "supposed to reduce call volume. We ended up with more calls because nobody could figure out how to navigate it."

### Technology Attitude

Dave is not anti-technology. He explicitly said: "I'm not against new tools. If something can help me get through my queue faster, great." But he immediately followed with: "Just don't make my life harder in the process."

This is the attitude of someone who has been burned. He's seen tools introduced that made promises and delivered headaches. His trust in new technology is conditional and fragile. The tool must earn his trust through immediate, visible competence. One bad experience - a false alarm on an obvious case, a confusing interface, a slow processing time - and Dave will close the tab and never open it again.

He prints his emails. He "spends enough time fighting with COLA as it is." Technology is a necessary burden in Dave's workday, not a source of satisfaction or excitement.

### Professional Identity

Dave's identity is built on judgment. He's the person who knows that "STONE'S THROW" and "Stone's Throw" are obviously the same brand name, and that a rigid system that fails to recognize this is a bad system. He described this exact scenario unprompted - it's clearly a frustration he's experienced with existing tools or processes.

His comment "you need judgment" is not just an observation - it's a statement about his value. Dave's value isn't in reading text off a label. A machine can do that. Dave's value is in knowing when a mismatch matters and when it doesn't. Any tool that tries to replace his judgment rather than supporting it will feel like a threat.

He also said "the thing about label review is there's nuance. You can't just pattern match everything." He's preemptively defending against the tool being too simplistic. He wants to be taken seriously as a professional whose expertise matters.

### Pain Points

**Volume.** Dave processes roughly 13 labels per day, every day. At 5-10 minutes per label, that's his full workday. He's fast because of experience, but he's still doing mechanical matching work that eats his time.

**The COLA system.** "I spend enough time fighting with COLA as it is." The existing system is a friction point. Dave doesn't want ANOTHER system to fight with. Any new tool must feel like a relief, not a new burden.

**Being ignored by technology initiatives.** Dave has watched multiple modernization projects "come and go." He's probably been interviewed for stakeholder feedback before, given his feedback, and then seen the resulting tool ignore everything he said. His opening line - "I'll be honest, I've seen a lot of these" - is the sound of someone managing their expectations downward.

### Goals

**Immediate:** Get through his daily queue faster without any new headaches.

**Functional:** A tool that pre-screens labels so he can focus his attention on the ones that actually need his judgment. He doesn't want to review 13 clean labels per day - he wants the tool to tell him which 3 of the 13 have real issues so he can spend his time there.

**Emotional:** Feel respected by the tool. When the tool says "REVIEW - case difference detected, likely the same brand name, recommend agent verification" - that's a tool that respects Dave's role. When the tool says "FAIL - brand name mismatch" on an obvious case difference - that's a tool that doesn't understand his job.

### Relationship to the Product

Dave is the **adoption gatekeeper**. If Dave uses the tool, the rest of the veteran agents will consider it. If Dave dismisses it, the tool is dead with half the team. Sarah knows this - her mental test for the tool is "Would Dave actually use this?"

Dave won't be the first to try it. He'll hear Jenny talking about it, or see it on a colleague's screen, and eventually give it a shot. The first 30 seconds of his first session determine everything. If the results make sense and the interface doesn't require learning a new system, he'll keep the tab open. If anything feels off, he closes it permanently.

### Key Quotes

> "I've seen a lot of these 'modernization' projects come and go."

> "The thing about label review is there's nuance. You can't just pattern match everything."

> "I had one last week where the brand name was 'STONE'S THROW' on the label but 'Stone's Throw' in the application. Technically a mismatch? Sure. But it's obviously the same thing. You need judgment."

> "I'm not against new tools. If something can help me get through my queue faster, great. Just don't make my life harder in the process."

### Design Implications

- The three-tier result system (Pass/Review/Fail) exists because of Dave. Binary pass/fail would produce false alarms that destroy trust.
- The tool must NEVER auto-decide. It recommends. Dave decides. This distinction is non-negotiable for adoption.
- The interface must require zero learning. Dave should look at the screen and immediately understand what he's seeing. If there's any moment of "where do I click?" or "what does this mean?" - it's a failure.
- Don't add features that add steps to Dave's workflow. Every interaction must subtract time from his day, never add to it.
- The REVIEW status with its plain-English explanation ("Case difference detected - likely the same brand name") is specifically designed to pass Dave's judgment test. The tool demonstrates that it understands nuance.
- Body text must be at least 16px. Dave is likely in his late 50s or early 60s, working under fluorescent office lighting, on a government-issued monitor that isn't the latest model.

---

# PERSONA 3: JENNY PARK

## Junior Compliance Agent - 8 Months of Service

---

### Background

Jenny is a junior compliance agent who has been at TTB for 8 months. She was hired relatively recently - likely straight out of college or from an early-career role. She's in the early phase of learning the job, building her knowledge base, and developing the pattern recognition that veteran agents like Dave have internalized over decades.

Her interview was a Teams call on a Friday afternoon. She was enthusiastic and detailed - volunteering specific examples, expressing excitement about the project, and articulating both her frustrations and her ideas clearly. She's comfortable with technology, comfortable with remote communication, and not shy about sharing her perspective.

### Personal Context

Jenny is young - likely early-to-mid 20s based on being described as "fresh out of college." Sarah said she "probably could have built this tool herself," which suggests Jenny has some technical literacy, possibly a degree in a field with a quantitative or technical component. She's digitally native in a way that most of her colleagues are not.

She's the youngest and newest person on a team where the average age is well above 40. She sees things about the workflow that veterans have stopped noticing because they've been doing it the same way for so long. Her phrase "it's 2024!" captures her reaction to discovering how manual the process is.

### Technology Attitude

Jenny is the opposite end of the spectrum from Dave. She's eager for technology, frustrated by its absence, and would be the first to adopt any new tool that makes her job easier. She described her current workflow with disbelief: "I literally have a printed checklist on my desk that I go through for every label. Brand name-check with my eyes. ABV-check with my eyes. Warning statement-check with my eyes."

She doesn't resist the checklist - she uses it diligently. But she recognizes it as a manual process that technology should be handling. She's the agent who would volunteer to beta test, give detailed feedback, and evangelize the tool to colleagues.

### Professional Identity

Jenny is building her professional identity. She's 8 months in - still learning the rules, still developing confidence. She relies on her printed checklist because she hasn't yet internalized the rules the way Dave has. She goes through every check meticulously because she's afraid of missing something.

She described catching a specific error with visible pride: "I caught one last month where they used 'Government Warning' in title case instead of all caps. Rejected." This catch validated her attention to detail and her growing expertise. She wants more moments like that - moments where she catches what others miss.

But she also knows she's slower than veterans and more likely to miss subtle errors because she's still learning. She checks the government warning "word-by-word" every time because she doesn't yet have the pattern recognition to spot errors at a glance. The tool would give her the speed and accuracy of a veteran while she's still developing her own expertise.

### Pain Points

**Speed vs. accuracy tradeoff.** Jenny is thorough but slow. She reads the government warning word-by-word because she's not confident enough to scan it. This diligence is good for quality but bad for throughput. She's likely aware that she processes fewer labels per day than Dave.

**Fear of missing errors.** Eight months in, Jenny is still in the phase where she worries about approving a non-compliant label. The consequences of missing something - a label that gets printed and distributed with an error - weigh on her. The printed checklist is a safety net against her own inexperience.

**The gap between what she expects and what she got.** Jenny expected modern tools when she joined a federal agency in 2024. She got a system that went online in 2003 and a printed checklist. The dissonance between her expectations and reality is a constant background frustration.

**Image quality.** Jenny raised a specific practical issue that nobody else mentioned: labels photographed at weird angles, with bad lighting, or with glare on the bottle. "Right now if an agent can't read the label they just reject it and ask for a better image." She sees this as a waste - a better tool could extract information from imperfect images instead of bouncing them back.

### Goals

**Immediate:** Process labels faster without sacrificing accuracy. The tool should be her digital checklist - faster and more reliable than the paper one on her desk.

**Learning:** Use the tool as a teaching aid. When the tool cites "27 CFR 5.65" for an ABV format rule, Jenny learns the regulation. Over time, the tool's explanations and citations build her domain knowledge.

**Validation:** When the tool catches an error that she would have caught manually - like the title-case "Government Warning" - it validates that her careful approach is right. When it catches something she might have missed, it protects her from making a mistake.

**Career:** Demonstrate competence and value. Being the first to adopt and champion a new tool makes Jenny visible as a forward-thinking team member.

### Relationship to the Product

Jenny is the **enthusiastic early adopter**. She'll be the first person to use the tool, the most forgiving of its imperfections, and the most vocal advocate if it works. She's the agent who will tell Dave "you should try this" and eventually convince him to give it a shot.

She'll use every feature. She'll expand every detail panel. She'll read the regulatory citations. She'll test the batch processing. She'll try uploading bad images to see what happens. Her feedback will be the most detailed and actionable.

If the tool catches the title-case "Government Warning" error in a demo, Jenny will be sold immediately. That specific catch - the one she's proudest of making manually - is the proof point that the tool understands her job.

### Key Quotes

> "When I started here, I was kind of shocked at how manual everything is."

> "I literally have a printed checklist on my desk that I go through for every label. Brand name-check with my eyes. ABV-check with my eyes. Warning statement-check with my eyes. It's 2024!"

> "The warning statement check is actually trickier than it sounds. It has to be exact. Like, word-for-word, and the 'GOVERNMENT WARNING:' part has to be in all caps and bold."

> "I caught one last month where they used 'Government Warning' in title case instead of all caps. Rejected."

> "It would be amazing if the tool could handle images that aren't perfectly shot."

### Design Implications

- The results screen IS Jenny's printed checklist, digitized. Same mental model: vertical list, one field per row, check each one, move on.
- The expandable detail panels with regulatory citations serve Jenny's learning goal. She'll actually read them. Dave won't - but he doesn't need to.
- The government warning deep-check with character-level diff is Jenny's favorite feature. It replaces her most tedious manual task (word-by-word reading) with instant, accurate verification.
- Confidence scores matter to Jenny. She wants to know when to trust the extraction and when to double-check. A field marked "97% confidence" gives her permission to trust it. A field marked "71% confidence" tells her to verify manually.
- Test label #2 (warning with title-case error and missing comma) should be Jenny's demo scenario - it recreates the exact catch she described making last month.

---

# PERSONA 4: MARCUS WILLIAMS

## IT Systems Administrator

---

### Background

Marcus is the IT systems administrator responsible for TTB's technology infrastructure. He's the person who keeps the systems running, manages security compliance, handles the Azure environment, and evaluates whether new technology is viable within the agency's constraints.

His interview was described as a "coffee chat, Thursday morning" - informal, peer-to-peer, technically oriented. Marcus talks about infrastructure the way Dave talks about labels: with deep experience, mild frustration, and dark humor. His quip "it's government infrastructure, let's leave it at that" carries decades of context about underfunding, legacy systems, and procurement pain.

### Personal Context

Marcus is likely in his 30s to 40s - experienced enough to have managed the Azure migration in 2019 and survived the FedRAMP certification process, but still engaged enough to have a coffee chat about a prototype rather than delegating it. He speaks about technology with the fluency of someone who keeps up with the industry but operates under constraints that would frustrate any private-sector engineer.

He understands the gap between what's technically possible and what's operationally feasible within a federal agency. He's not cynical about it - he's realistic. He's the person who knows that the $4.2 million COLA rebuild quote "went nowhere, obviously" because he understands how government procurement works.

### Technology Attitude

Marcus is the most technically sophisticated person in the interview set, but he's also the most constrained. He knows what good technology looks like. He also knows what government compliance, FedRAMP certification, network firewalls, and legacy .NET systems mean in practice.

He described the FedRAMP certification for the Azure migration as "18 months just for the paperwork." He's not complaining - he's calibrating your expectations. Any production deployment of this tool would go through the same gauntlet. He wants you to know that so you don't build something that can't survive the transition.

He raised the firewall issue proactively: "our network blocks outbound traffic to a lot of domains... during the scanning vendor pilot, half their features didn't work because our firewall blocked connections to their ML endpoints." He's seen a tool fail specifically because the builders didn't account for his network environment. He's warning you not to make the same mistake.

### Pain Points

**Legacy infrastructure.** The COLA system is built on .NET and has been running since 2003. A contractor quoted $4.2 million for a full rebuild. That didn't happen. Marcus manages a 20+ year old system that everyone depends on and nobody wants to replace badly enough to fund it.

**Procurement friction.** Marcus lives in a world where every new tool requires security review, FedRAMP compliance evaluation, network whitelisting, and procurement justification. He can't just install something and try it. The scanning vendor pilot failed in part because nobody anticipated the firewall issue - a failure of planning, not of technology.

**Security and compliance burden.** PII considerations, document retention policies, authorization requirements. Marcus has to think about these for every new system, even a prototype. His comment "just don't do anything crazy" is shorthand for "I don't want to have to fill out a security incident report because of your prototype."

**Being the bottleneck.** Marcus is probably the person who has to evaluate, approve, or reject every new technology request. He doesn't want to be the person who says no - but he often has to, because the technology doesn't meet compliance requirements or can't operate within the network constraints.

### Goals

**For this prototype:** Keep it simple. Keep it standalone. Don't create security risks. Don't try to integrate with COLA. Build something that works outside the agency's infrastructure so he doesn't have to worry about it today.

**For the future:** If the prototype succeeds, Marcus wants a clear path from "prototype running on cloud infrastructure" to "production tool running within our Azure environment." He needs to know what would have to change, what APIs would need whitelisting, and what compliance steps would be required. He's already thinking two steps ahead.

**Personally:** Marcus wants to be the IT leader who helped bring AI into TTB's workflow - not the one who blocked it. But he'll only support it if the technology is architecturally sound, security-conscious, and realistic about government constraints.

### Relationship to the Product

Marcus is the **technical gatekeeper**. He won't use the tool daily - he'll evaluate whether it's viable for production deployment. He reads the README. He looks at the architecture diagram. He checks whether the tool persists data. He asks what external APIs it calls.

His approval isn't required for the prototype, but it's required for anything beyond the prototype. If Marcus reads the documentation and thinks "this was built by someone who understands our environment," the procurement conversation advances. If he thinks "this person has no idea how government IT works," it dies.

### Key Quotes

> "Our current infrastructure is... well, it's government infrastructure, let's leave it at that."

> "The COLA system is built on .NET, though there's been talk about modernizing it for years. We had a contractor come in last summer to do an assessment and they quoted us $4.2 million for a full rebuild. That went nowhere, obviously."

> "Think of this as a standalone proof-of-concept that could potentially inform future procurement decisions."

> "Security-wise, we'd need to be careful with any production deployment - there's PII considerations, document retention policies, the usual federal compliance stuff. But for a prototype? Just don't do anything crazy."

> "Our network blocks outbound traffic to a lot of domains... during the scanning vendor pilot, half their features didn't work because our firewall blocked connections to their ML endpoints. Classic."

### Design Implications

- The README matters more for Marcus than any UI screen. Architecture diagrams, security posture, data flow documentation, deployment considerations - this is what Marcus reads.
- "No data persisted" should be stated explicitly in documentation and subtly reinforced in the UI (the footer note: "No data is stored").
- The mock auth screen (PIV/CAC simulation) signals to Marcus that the builder understands Treasury's authentication environment.
- The "Future Enhancements" section of the README should address Marcus's concerns directly: Azure deployment path, FedRAMP considerations, API endpoint whitelisting, on-premise model hosting options.
- Frame the prototype as a "$0 API integration path" versus the $4.2 million COLA rebuild. Marcus understands this trade-off immediately.

---

# PERSONA 5: JANET (INFERRED)

## Compliance Agent, Seattle Office - Batch Processing Champion

---

### Background

Janet is not directly interviewed but is mentioned by name by Sarah Chen: "Janet from our Seattle office has been asking about this for years." Janet is a compliance agent in TTB's Seattle regional office who handles large importers - companies that submit 200-300 label applications at once.

### What We Can Infer

Janet works remotely from the Washington D.C. headquarters. She's part of TTB's distributed team. Her workload is characterized by volume spikes rather than steady flow - when a big importer submits a batch, Janet suddenly has hundreds of labels to process, and the current system forces her to do them one at a time.

She has been asking for batch processing capabilities "for years" - meaning she's articulated this need repeatedly through official channels without it being addressed. This suggests she's experienced (she's been around long enough to ask "for years"), persistent, and frustrated by the lack of response.

She's probably a mid-career agent - senior enough to handle the large importers (which are likely the most complex accounts) but not in a management role. She's in the trenches doing the work, and the one-at-a-time constraint is a daily operational bottleneck.

### Pain Points

**The one-at-a-time bottleneck.** Sarah said agents "literally have to process them one at a time." For Janet, this means a batch of 200 labels from a single importer could take her 2-3 weeks of dedicated work. During peak season, multiple batches may arrive simultaneously.

**Geographic isolation.** Being in the Seattle office means Janet may have less visibility into D.C.-based initiatives. She's asked for batch processing for years, which suggests her voice hasn't been heard with the same urgency as if she were in the main office.

**Peak season pressure.** Q4 accounts for roughly 70% of annual business volume. Holiday-themed seasonal products create a surge. Janet's large importers are likely the biggest contributors to this surge.

### Relationship to the Product

Janet is the **batch processing use case personified.** Sarah named her specifically because Janet's need is real, documented, and unmet. Including batch processing in the prototype is a direct response to a named individual's multi-year request. This is not a theoretical feature - it has a specific champion within the organization.

If the prototype includes batch processing and works well, Sarah can go to Janet and say "we heard you." That's powerful for internal advocacy.

### Design Implications

- The batch upload, processing progress, dashboard, and CSV export features exist because of Janet.
- The dashboard must handle 50+ results efficiently - sortable, filterable, with drill-down capability. Janet doesn't need to see every detail at once; she needs to quickly find the problems.
- The CSV export is critical - Janet needs to document her work and potentially share results with supervisors or the importers themselves.
- Default sort of "failures first" respects Janet's workflow: deal with the problems first, confirm the clean ones after.

---

# PERSONA SPECTRUM SUMMARY

The four named personas form a spectrum across two dimensions that matter most for this tool:

**Technology comfort:**

```text
Dave ----------- Sarah ----------- Marcus ----------- Jenny
(Prints emails)  (Pragmatic)       (Technical)        (Digital native)
```

**Domain expertise:**

```text
Jenny ----------- Janet ----------- Sarah ----------- Dave
(8 months)        (Mid-career)      (Management)      (28 years)
```

The tool must work for everyone on both spectrums simultaneously. The UI must be simple enough for Dave and rich enough for Jenny. The results must be accurate enough for Dave's judgment and educational enough for Jenny's learning. The architecture must be pragmatic enough for Sarah's procurement case and sound enough for Marcus's technical review.

The design challenge is not choosing between these users - it's serving all of them with the same interface. The expandable detail panel is the key mechanism: collapsed, it gives Dave the quick scan he wants. Expanded, it gives Jenny the learning context she needs. The batch dashboard serves Janet. The README and architecture documentation serve Marcus. The overall polish and value proposition serve Sarah.

---

# HOW EACH PERSONA FIRST ENCOUNTERS THE TOOL

Understanding the first 30 seconds of each persona's experience:

**Sarah** opens the deployed URL to evaluate it before showing it to her team. She uploads a test label, watches the processing animation, sees results in under 5 seconds. She scans the verdict banner - green, all pass. She thinks: "It's fast." She uploads the warning-error test label. Red banner, clear explanation of what's wrong. She thinks: "Dave might actually use this."

**Dave** hears Jenny mention the tool. He's skeptical but opens it because he has a slow afternoon. He drags a label from his current queue onto the upload zone. He doesn't enter application data - he just wants to see what it does. Results appear in 3 seconds. He sees a green checkmark next to every field. He glances at the extracted values - they're right. He tries one with a brand name variation. The tool shows "REVIEW - case difference detected." He thinks: "Okay. That's not dumb." He keeps the tab open.

**Jenny** opens the tool the moment she hears about it. She uploads a label AND enters all the application data. She clicks Verify. Results appear. She immediately expands every row, reads every explanation, notes the regulatory citations. She expands the government warning and sees the sub-check list. She sees "All punctuation correct" and thinks about the comma she caught last month. She thinks: "Where has this been my whole career?"

**Marcus** doesn't open the app first. He reads the README. He looks for the architecture description, the data flow, the security posture. He sees "No data is persisted." He sees the PIV/CAC mock. He sees the future deployment path. He opens the app, uploads a label to verify it works, doesn't expand any detail panels - he's not evaluating the compliance features, he's evaluating the engineering. He checks the network tab in dev tools to see what external calls are being made. He thinks: "This was built by someone who understands our constraints."

**Janet** doesn't try the tool until someone tells her about the batch feature. Then she immediately uploads 20 labels and a CSV. She watches the progress bar. She sees the dashboard. She filters to failures. She drills into the first one, verifies the issue, goes back to the dashboard. She exports the CSV. She thinks: "I've been asking for this for years."
