import * as jsonpatch from 'fast-json-patch'
import { getValueByPointer, applyPatch } from 'fast-json-patch'
import { BASIC_FIELD_MAPPING } from './constants'
import { BasicFieldErrorObj } from './types'
import { ValidationRules } from './validationRules'

const basicFieldArray = Object.keys(BASIC_FIELD_MAPPING)
let templateFromBasicValue
const validationRules = new ValidationRules()

export const updateTemplateFromBasicValue = (template): void => {
    templateFromBasicValue = template
}

export const isBasicValueChanged = (modifiedTemplate, defaultTemplate?): boolean => {
    if (!templateFromBasicValue && !defaultTemplate) return false
    const _patchData = jsonpatch.compare(defaultTemplate || templateFromBasicValue, modifiedTemplate)
    for (let index = 0; index < _patchData.length; index++) {
        const path = _patchData[index].path
        for (let index = 0; index < basicFieldArray.length; index++) {
            if (path.indexOf(BASIC_FIELD_MAPPING[basicFieldArray[index]]) === 0) {
                return true
            }
        }
    }
}

export const getBasicFieldValue = (template) => {
    templateFromBasicValue = template
    const _basicFieldValues: Record<string, any> = {}
    for (let index = 0; index < basicFieldArray.length; index++) {
        const key = basicFieldArray[index]
        _basicFieldValues[key] = getValueByPointer(template, BASIC_FIELD_MAPPING[key])
    }
    _basicFieldValues['hosts'] = [_basicFieldValues['hosts'][0]]
    _basicFieldValues['resources']['requests'] = { ..._basicFieldValues['resources']['limits'] }
    return _basicFieldValues
}

export const validateBasicView = (basicFieldValues: Record<string, any>): BasicFieldErrorObj => {
    const _portValidation = validationRules.port(Number(basicFieldValues['port']))
    const _cpuValidation = validationRules.port(basicFieldValues['resources']?.['limits']?.['cpu'])
    const _memoryValidation = validationRules.port(basicFieldValues['resources']?.['limits']?.['memory'])
    const _basicFieldErrorObj = {
        isValid: _portValidation.isValid && _cpuValidation.isValid && _memoryValidation.isValid,
        port: _portValidation,
        cpu: _cpuValidation,
        memory: _memoryValidation,
        envVariables: [],
    }
    for (let index = 0; index < basicFieldValues['envVariables'].length; index++) {
        const element = basicFieldValues['envVariables'][index]
        const _envVariableValidation = validationRules.envVariable(element)
        _basicFieldErrorObj.envVariables.push(_envVariableValidation)
        _basicFieldErrorObj.isValid = _basicFieldErrorObj.isValid && _envVariableValidation.isValid
    }
    return _basicFieldErrorObj
}

export const patchBasicData = (_template, basicFieldValues: Record<string, any>) => {
    const basicFieldPatchData = []
    const basicFieldValuesKey = Object.keys(basicFieldValues)
    for (let index = 0; index < basicFieldValuesKey.length; index++) {
        const key = basicFieldArray[index]
        basicFieldPatchData.push({
            op: 'replace',
            path: BASIC_FIELD_MAPPING[key],
            value: basicFieldValues[key],
        })
    }
    return applyPatch(_template, basicFieldPatchData).newDocument
}