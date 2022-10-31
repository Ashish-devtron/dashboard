import Tippy from '@tippyjs/react'
import React, { useEffect, useState } from 'react'
import ReactSelect from 'react-select'
import { MODES } from '../../config'
import { OptionType } from '../app/types'
import CodeEditor from '../CodeEditor/CodeEditor'
import { copyToClipboard, Progressing, showError } from '../common'
import { DropdownIndicator, Option } from '../v2/common/ReactSelect.utils'
import { ReactComponent as Clipboard } from '../../assets/icons/ic-copy.svg'
import { ReactComponent as Reset } from '../../assets/icons/ic-arrow-anticlockwise.svg'
import { CIBuildType } from '../ciPipeline/types'
import { CICreateDockerfileOptionProps, FrameworkOptionType, TemplateDataType } from './types'

export default function CICreateDockerfileOption({
    configOverrideView,
    allowOverride,
    frameworks,
    currentCIBuildConfig,
    setCurrentCIBuildConfig,
    setInProgress,
}: CICreateDockerfileOptionProps) {
    const [languages, setLanguages] = useState<OptionType[]>([])
    const [languageFrameworks, setLanguageFrameworks] = useState<Map<string, FrameworkOptionType[]>>()
    const [selectedLanguage, setSelectedLanguage] = useState<OptionType>()
    const [selectedFramework, setSelectedFramework] = useState<FrameworkOptionType>()
    const [templateData, setTemplateData] = useState<Record<string, TemplateDataType>>() // key: language-framework
    const [editorValue, setEditorValue] = useState<string>('')
    const [copied, setCopied] = useState(false)
    const controller = new AbortController()
    const signal = controller.signal

    useEffect(() => {
        if (frameworks.length > 0) {
            const _languageFrameworks = new Map<string, FrameworkOptionType[]>()
            for (const _framework of frameworks) {
                if (!_languageFrameworks.has(_framework.Language)) {
                    const _frameworksList = frameworks
                        .filter((f) => f.Language === _framework.Language)
                        .map((lf) => ({
                            label: lf.Framework,
                            value: lf.Framework,
                            templateUrl: lf.TemplateUrl,
                        }))
                    _languageFrameworks.set(_framework.Language, _frameworksList)
                }
            }

            const _languages = [..._languageFrameworks.keys()].map((_lang) => ({
                label: _lang,
                value: _lang,
            }))
            setLanguages(_languages)
            setLanguageFrameworks(_languageFrameworks)

            const _selectedLanguage = currentCIBuildConfig.dockerBuildConfig.language
                ? {
                      label: currentCIBuildConfig.dockerBuildConfig.language,
                      value: currentCIBuildConfig.dockerBuildConfig.language,
                  }
                : _languages[0]
            setSelectedLanguage(_selectedLanguage)

            const _frameworks = _languageFrameworks.get(
                currentCIBuildConfig.dockerBuildConfig.language || _languages[0].value,
            )
            const _selectedFramework =
                _frameworks.find((_f) => _f.value === currentCIBuildConfig.dockerBuildConfig.languageFramework) ||
                _frameworks[0]
            setSelectedFramework(_selectedFramework)

            if (
                currentCIBuildConfig.dockerBuildConfig.language &&
                _selectedLanguage.value === currentCIBuildConfig.dockerBuildConfig.language &&
                currentCIBuildConfig.dockerBuildConfig.languageFramework &&
                _selectedFramework.value === currentCIBuildConfig.dockerBuildConfig.languageFramework
            ) {
                setTemplateData({
                    ...templateData,
                    [`${_selectedLanguage.value}-${_selectedFramework.value}`]: {
                        fetching: false,
                        data: currentCIBuildConfig.dockerBuildConfig.dockerfileContent,
                    },
                })
                setEditorValue(currentCIBuildConfig.dockerBuildConfig.dockerfileContent)
            } else {
                getTemplateData(_selectedLanguage, _selectedFramework)
            }
        }

        return (): void => {
            // Abort the ongoing request if user switches between the build types
            controller.abort()
        }
    }, [frameworks])

    const getTemplateData = async (_selectedLanguage, _selectedFramework) => {
        const templateKey = `${_selectedLanguage?.value}-${_selectedFramework?.value}`
        const _currentData = templateData?.[templateKey]

        if (_currentData?.fetching) {
            return
        } else if (_currentData?.data) {
            setTemplateData({
                ...templateData,
                [templateKey]: {
                    fetching: false,
                    data: _currentData.data,
                },
            })
            setEditorValue(_currentData.data)
        } else if (_selectedFramework?.templateUrl) {
            setInProgress(true)
            setTemplateData({
                ...templateData,
                [templateKey]: {
                    fetching: true,
                    data: '',
                },
            })

            try {
                const respData = await fetch(_selectedFramework.templateUrl, {
                    method: 'get',
                    signal: signal,
                }).then((res) => {
                    return res.text()
                })

                setTemplateData({
                    ...templateData,
                    [templateKey]: {
                        fetching: false,
                        data: respData,
                    },
                })
                setEditorValue(respData)
                setCurrentCIBuildConfig({
                    ...currentCIBuildConfig,
                    ciBuildType: CIBuildType.MANAGED_DOCKERFILE_BUILD_TYPE,
                    dockerBuildConfig: {
                        ...currentCIBuildConfig.dockerBuildConfig,
                        dockerfileContent: respData,
                        language: _selectedLanguage?.value,
                        languageFramework: _selectedFramework?.value,
                    },
                })
                setInProgress(false)
            } catch (err) {
                // Don't show error toast or log the error as user aborted the request
                if (!signal.aborted) {
                    showError(err)
                }
                setTemplateData({
                    ...templateData,
                    [templateKey]: {
                        fetching: false,
                        data: '',
                    },
                })
                setEditorValue('')
                setInProgress(false)
            }
        } else {
            setTemplateData({
                ...templateData,
                [templateKey]: {
                    fetching: false,
                    data: '',
                },
            })
            setEditorValue('')
        }
    }

    const handleLanguageSelection = (selected) => {
        setSelectedLanguage(selected)

        const _selectedFramework = languageFrameworks.get(selected.value)?.[0] || null
        setSelectedFramework(_selectedFramework)
        getTemplateData(selected, _selectedFramework)
    }

    const handleFrameworkSelection = (selected) => {
        setSelectedFramework(selected)
        getTemplateData(selectedLanguage, selected)
    }

    const customStyles = {
        control: (base) => ({
            ...base,
            border: 'none',
            boxShadow: 'none',
            minHeight: '32px',
            cursor: 'pointer',
        }),
        singleValue: (base) => ({
            ...base,
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--N900)',
        }),
        option: (base, state) => ({
            ...base,
            color: 'var(--N900)',
            backgroundColor: state.isFocused ? 'var(--N100)' : 'white',
        }),
        menu: (base) => ({
            ...base,
            marginTop: '2px',
            minWidth: '240px',
        }),
        menuList: (base) => ({
            ...base,
            position: 'relative',
            paddingBottom: 0,
            paddingTop: 0,
            maxHeight: '250px',
        }),
        dropdownIndicator: (base, state) => ({
            ...base,
            padding: 0,
            color: 'var(--N400)',
            transition: 'all .2s ease',
            transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        }),
        noOptionsMessage: (base) => ({
            ...base,
            color: 'var(--N600)',
        }),
    }

    const resetChanges = () => {
        const editorData = templateData?.[`${selectedLanguage?.value}-${selectedFramework?.value}`]
        setEditorValue(editorData?.data)
        setCurrentCIBuildConfig({
            ...currentCIBuildConfig,
            dockerBuildConfig: {
                ...currentCIBuildConfig.dockerBuildConfig,
                dockerfileContent: editorData?.data,
                language: selectedLanguage?.value,
                languageFramework: selectedFramework?.value,
            },
        })
    }

    const renderLanguageOptions = (editorData: TemplateDataType) => {
        return (
            <div className="flex">
                <span className="fs-13 fw-4 lh-20 cn-7 mr-8">Language</span>
                {configOverrideView && !allowOverride ? (
                    <span className="fs-13 fw-6 lh-20 cn-9">{selectedLanguage?.label}</span>
                ) : (
                    <ReactSelect
                        tabIndex={3}
                        options={languages}
                        value={selectedLanguage}
                        isSearchable={false}
                        styles={customStyles}
                        components={{
                            IndicatorSeparator: null,
                            DropdownIndicator,
                            Option,
                        }}
                        onChange={handleLanguageSelection}
                        isDisabled={configOverrideView && !allowOverride}
                    />
                )}
                {languageFrameworks?.get(selectedLanguage?.value)?.[0]?.value && (
                    <>
                        <div className="h-22 dc__border-right-n1 mr-8 ml-8" />
                        <span className="fs-13 fw-4 lh-20 cn-7 mr-8">Framework</span>
                        {configOverrideView && !allowOverride ? (
                            <span className="fs-13 fw-6 lh-20 cn-9">{selectedFramework?.label}</span>
                        ) : (
                            <ReactSelect
                                tabIndex={3}
                                options={languageFrameworks?.get(selectedLanguage?.value) || []}
                                value={selectedFramework}
                                isSearchable={false}
                                styles={customStyles}
                                components={{
                                    IndicatorSeparator: null,
                                    DropdownIndicator,
                                    Option,
                                }}
                                onChange={handleFrameworkSelection}
                                isDisabled={configOverrideView && !allowOverride}
                            />
                        )}
                    </>
                )}
                {!editorData?.fetching && editorData?.data !== editorValue && (
                    <>
                        <div className="h-22 dc__border-right-n1 mr-8 ml-8" />
                        <div className="flex left cursor" onClick={resetChanges}>
                            <div className="icon-dim-12 flex">
                                <Reset className="icon-dim-12" />
                            </div>
                            <span className="ml-4">Reset changes</span>
                        </div>
                    </>
                )}
            </div>
        )
    }

    const handleCopyToClipboard = (e) => {
        e.stopPropagation()
        copyToClipboard(editorValue, () => setCopied(true))
    }

    const handleEditorValueChange = (value: string) => {
        setEditorValue(value)

        if (templateData && currentCIBuildConfig.dockerBuildConfig?.language) {
            setCurrentCIBuildConfig({
                ...currentCIBuildConfig,
                dockerBuildConfig: {
                    ...currentCIBuildConfig.dockerBuildConfig,
                    dockerfileContent: value,
                },
            })
        }
    }

    const editorData = templateData?.[`${selectedLanguage?.value}-${selectedFramework?.value}`]
    return (
        <div className="create-dockerfile-option dc__border br-4 mb-16 dc__overflow-hidden">
            <CodeEditor
                loading={editorData?.fetching}
                customLoader={
                    <div className="h-300">
                        <Progressing pageLoader fullHeight />
                    </div>
                }
                value={editorValue || editorData?.data}
                mode={MODES.DOCKERFILE}
                height="300px"
                readOnly={configOverrideView && !allowOverride}
                onChange={handleEditorValueChange}
            >
                <CodeEditor.Header>
                    <div className="flex dc__content-space w-100 fs-12 fw-6 cn-7">
                        {renderLanguageOptions(editorData)}
                        {(!configOverrideView || allowOverride) && (
                            <Tippy
                                className="default-tt"
                                arrow={false}
                                placement="bottom"
                                content={copied ? 'Copied!' : 'Copy'}
                                trigger="mouseenter click"
                                onShow={(_tippy) => {
                                    setTimeout(() => {
                                        _tippy.hide()
                                        setCopied(false)
                                    }, 5000)
                                }}
                                interactive={true}
                            >
                                <Clipboard onClick={handleCopyToClipboard} className="icon-dim-16 cursor" />
                            </Tippy>
                        )}
                    </div>
                </CodeEditor.Header>
            </CodeEditor>
            <div></div>
        </div>
    )
}
